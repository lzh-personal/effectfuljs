import {
  logger,
  Logger,
  InitializedEvent,
  Response,
  Event,
  TerminatedEvent,
  BreakpointEvent,
  Thread,
  ThreadEvent,
  CapabilitiesEvent,
  OutputEvent,
  DebugSession as SessionImpl
} from "vscode-debugadapter";

import { DebugProtocol as P } from "@effectful/debugger/vscode/protocol";
import { toThread, normalizeDrive } from "@effectful/debugger/state";
import { Handler } from "./comms";
import { Message } from "vscode-debugadapter/lib/messages";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import subscribe from "./wscomms";

const DEBUGGER_IMPL = require.resolve("@effectful/debugger");
const DEBUGGER_EDBG = path.join(path.dirname(DEBUGGER_IMPL), "bin", "edbg.js");
const DEBUGGER_PATHS = path.resolve(path.join(DEBUGGER_IMPL, "..", ".."));
const runningCommands: Map<string, ChildProcess> = new Map();

const RUNINTERMINAL_TIMEOUT = 5000;
const CONFIGURATION_DONE_REQUEST_TIMEOUT = 1000;

export class DebugSession extends SessionImpl {
  private remotes: Map<number, Handler> = new Map();
  private connectCb?: (h?: Handler) => void;
  private progressCb?: () => void;
  public progressHandler?: (n: string) => () => void;
  public showError?: (n: string) => void;
  private childProcess: ChildProcess | undefined;
  private stopped: boolean = false;
  private supportsRunInTerminalRequest = false;
  private awaitReconnect: number | undefined;
  private stopComms?: () => void;
  private launchArgs: P.LaunchRequestArguments | undefined;
  private launched = false;
  private exceptionArgs: P.SetExceptionBreakpointsArguments | undefined;
  private exitCode: number | undefined;

  private hideProgress() {
    if (this.progressCb) {
      this.progressCb();
      this.progressCb = void 0;
    }
  }
  private showProgress(title: string) {
    this.hideProgress();
    if (this.progressHandler) this.progressCb = this.progressHandler(title);
  }

  /**
   * Creates a new debug adapter that is used for one debug session.
   * We configure the default implementation of a debug adapter here.
   */
  public constructor() {
    super(true);
    // super("effectful-debug.log", true);
    // this.obsolete_logFilePath = obsolete_logFilePath;
    this.on("error", event => {
      logger.error(event.body);
    });
    this.setDebuggerLinesStartAt1(false);
    this.setDebuggerColumnsStartAt1(false);
  }

  start(inStream: NodeJS.ReadableStream, outStream: NodeJS.WritableStream) {
    super.start(inStream, outStream);
    logger.init(e => this.sendEvent(e), "effectful-debug.log", this._isServer);
  }

  sendEvent(event: P.Event): void {
    if (event.event !== "output")
      logger.verbose(`sendEvent: ${JSON.stringify(event)}`);
    super.sendEvent(event);
  }

  sendRequest(
    command: string,
    args: any,
    timeout: number,
    cb: (response: P.Response) => void
  ) {
    logger.verbose(
      `sendRequest: ${JSON.stringify(command)}(${JSON.stringify(
        args
      )}), timeout: ${timeout}`
    );
    super.sendRequest(command, args, timeout, cb);
  }

  sendResponse(response: P.Response) {
    logger.verbose(`sendResponse: ${JSON.stringify(response)}`);
    super.sendResponse(response);
  }

  private async closeRemote(remoteId: number) {
    const hadThread = this.remotes.delete(remoteId);
    if (hadThread) this.sendEvent(new ThreadEvent("exited", remoteId));
    if (!this.remotes.size) {
      if (this.awaitReconnect) {
        if (this.awaitReconnect < 0) return;
        await new Promise(i => setTimeout(i, this.awaitReconnect));
        if (this.remotes.size) return;
      }
      this.terminate(
        this.exitCode
          ? `the main command exited with exit code ${this.exitCode}`
          : "all threads are finished"
      );
    }
  }

  /**
   * The 'initialize' request is the first request called by the frontend
   * to interrogate the features the debug adapter provides.
   */
  protected initializeRequest(
    response: P.InitializeResponse,
    args: P.InitializeRequestArguments
  ): void {
    this.supportsRunInTerminalRequest = !!args.supportsRunInTerminalRequest;
    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsStepBack = true;
    response.body.supportsSetVariable = true;
    response.body.supportsSetExpression = true;
    response.body.supportsTerminateRequest = true;
    response.body.supportTerminateDebuggee = true;
    response.body.supportsLogPoints = true;
    response.body.supportsHitConditionalBreakpoints = true;
    response.body.supportsConditionalBreakpoints = true;
    response.body.supportsFunctionBreakpoints = false;
    response.body.supportsEvaluateForHovers = false;
    response.body.supportsCompletionsRequest = false;
    response.body.supportsRestartRequest = false;
    response.body.supportsRestartFrame = false;
    response.body.supportsExceptionOptions = true;
    response.body.supportsExceptionInfoRequest = false;
    response.body.supportsValueFormattingOptions = false;
    response.body.supportsTerminateThreadsRequest = true;
    response.body.supportsDataBreakpoints = false;
    response.body.supportsReadMemoryRequest = false;
    response.body.supportsDisassembleRequest = false;
    response.body.supportsCancelRequest = false;
    response.body.supportsBreakpointLocationsRequest = false;
    response.body.supportsStepInTargetsRequest = false;
    response.body.exceptionBreakpointFilters = [
      { filter: "all", label: "All Exceptions", default: false },
      { filter: "uncaught", label: "Uncaught Exceptions", default: false }
    ];
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }
  private async sendAll(request: P.Request) {
    if (!this.stopped) {
      for (const remote of this.remotes.values()) {
        remote.send(request);
      }
    }
  }
  protected sendToThread(threadId: number, msg: P.Request) {
    const thread = this.remotes.get(threadId);
    if (!thread) {
      logger.verbose(`no remote ${threadId}`);
      this.closeRemote(threadId);
      return false;
    }
    thread.send(msg);
    return true;
  }
  protected async dispatchRequest(request: P.Request) {
    logger.log(`dispatchRequest: ${JSON.stringify(request)}`);
    if (this.stopped) return;
    switch (request.command) {
      case "restart":
        this.sendAll({ ...request, command: "childRestart" });
        this.sendResponse(new Response(request));
        return;
      case "setExceptionBreakpoints":
        this.sendResponse(new Response(request));
        this.exceptionArgs = request.arguments;
        this.sendAll({ ...request, command: "childSetExceptionBreakpoints" });
        return;
      case "setBreakpoints":
        this.doSetBreakpoints(<P.SetBreakpointsRequest>request);
        return;
      case "terminateThreads":
        const threadIds = request.arguments.threadIds;
        if (threadIds)
          for (const i of threadIds)
            this.sendToThread(i, { ...request, command: "childTerminate" });
        this.sendResponse(new Response(request));
        break;
      case "source":
        {
          const args: any = request.arguments;
          if (
            args.sourceReference != null &&
            this.sendToThread(toThread(args.sourceReference), request)
          )
            return;
        }
        break;
      case "continue":
      case "next":
      case "stackTrace":
      case "stepIn":
      case "stepOut":
      case "stepBack":
      case "goto":
      case "pause":
      case "exceptionInfo":
      case "stackTrace":
      case "scopes":
      case "variables":
      case "evaluate":
      case "setExpression":
      case "reverseContinue":
        const args: any = request.arguments;
        if (args.threadId != null) {
          if (this.sendToThread(args.threadId, request)) return;
          break;
        }
        if (args.frameId != null) {
          if (this.sendToThread(toThread(args.frameId), request)) return;
          break;
        }
        if (args.variablesReference) {
          if (this.sendToThread(toThread(args.variablesReference), request))
            return;
          break;
        }
        logger.error("no thread's destination");
        break;
      case "terminate":
        this.sendAll({ ...request, command: "childTerminate" });
        this.sendResponse(new Response(request));
        this.terminate();
        return;
      case "disconnect":
        this.shutdown();
        this.sendResponse(new Response(request));
        return;
      default:
        super.dispatchRequest(request);
    }
  }

  private terminate(reason?: string) {
    if (reason) logger.verbose(`termination request: ${reason}`);
    if (!this.stopped) this.sendEvent(new TerminatedEvent());
  }

  private dispatchResponse(thread: Handler, data: Message) {
    if ((<any>data).event !== "output")
      logger.verbose(`response: ${JSON.stringify(data)}`);
    if (data.type === "event") {
      let ev = <Event>data;
      switch (ev.event) {
        case "loadedSources":
          const lsev = <any>ev;
          if (lsev.body.breakpoints)
            this.convertResponseBreakpoints(lsev.body.breakpoints);
          delete lsev.body.breakpoints;
          break;
        case "continued":
        case "stopped":
        case "thread":
          (<any>ev).body.threadId = thread.id;
      }
      this.sendEvent(ev);
    } else if (data.type === "response") {
      const response = <P.Response>data;
      switch (response.command) {
        case "continue":
          (response.body || (response.body = {})).allThreadsContinued = false;
          break;
        case "childSetExceptionBreakpoints":
        case "childTerminate":
        case "childRestart":
          return;
        case "childLaunch":
          if (!thread.name) thread.name = `Thread ${thread.id}`;
          this.sendEvent(new ThreadEvent("started", thread.id));
          if (response.body && response.body.breakpoints) {
            for (const i of response.body.breakpoints)
              this.convertResponseBreakpoints(i.breakpoints);
          }
          return;
        case "childSetBreakpoints":
          const pbody = (<P.SetBreakpointsResponse>response).body;
          if (response.body && response.body.breakpoints) {
            pbody.breakpoints = this.convertResponseBreakpoints(
              response.body.breakpoints,
              true
            );
          }
          response.command = "setBreakpoints";
          if (this.breakpointsResponse) {
            this.breakpointsResponse = void 0;
            this.sendResponse(response);
          }
          return;
      }
      this.sendResponse(response);
    }
  }

  public shutdown() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.connectCb) this.connectCb();
    this.hideProgress();
    for (const i of this.remotes.values()) i.close();
    if (this.stopComms) this.stopComms();
    if (this.childProcess) this.childProcess.kill();
    super.shutdown();
  }

  private configurationCb?: () => void;

  protected sendErrorResponse(
    response: P.Response,
    code: number,
    msg: string
  ): void {
    super.sendErrorResponse(response, code, msg);
    // TODO: check why VS doesn't show this itself
    if (this.showError && msg) this.showError(msg);
  }

  /**
   * Called at the end of the configuration sequence.
   * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
   */
  protected configurationDoneRequest(
    response: P.ConfigurationDoneResponse,
    args: P.ConfigurationDoneArguments
  ): void {
    super.configurationDoneRequest(response, args);
    if (this.configurationCb) this.configurationCb();
  }

  protected async launchRequest(
    response: P.LaunchResponse,
    args: P.LaunchRequestArguments
  ) {
    logger.setup(
      args.verbose ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop,
      false
    );
    this.stopComms = subscribe(
      (remote: Handler) => {
        logger.verbose(`new debuggee: ${remote.id}`);
        this.remotes.set(remote.id, remote);
        remote.onclose = () => this.closeRemote(remote.id);
        remote.onmessage = data => this.dispatchResponse(remote, <Message>data);
        remote.onerror = reason => logger.error(reason);
        if (this.launched) this.launchChild(remote);
        if (this.connectCb) this.connectCb();
      },
      args.debuggerHost || "localhost",
      args.debuggerPort || 20011
    );
    this.launchArgs = args;
    if (args.verbose) logger.verbose(`launch request ${JSON.stringify(args)}`);
    if (!args.timeTravel || args.preset !== "node")
      this.sendEvent(
        new CapabilitiesEvent({
          supportsStepBack: args.timeTravel,
          supportsRestartFrame: false, // args.timeTravel,
          supportsRestartRequest: args.preset !== "node"
        })
      );
    if (args.preset && !args.command) args.command = true;
    let errMessage: string | undefined;
    let key: string | undefined;
    if (args.reconnectTimeout)
      this.awaitReconnect = args.reconnectTimeout * 1000;
    if (args.command) {
      const env: { [name: string]: string | null } = <any>{};
      //TODO: resolve
      const host =
        !args.debuggerHost ||
        args.debuggerHost === "::" ||
        args.debuggerHost === "0.0.0.0"
          ? "localhost"
          : args.debuggerHost;
      if (process.env["EFFECTFUL_DEBUGGER_VERBOSE"] == null)
        env["EFFECTFUL_DEBUGGER_VERBOSE"] = args.verbose
          ? String(args.verbose)
          : "0";
      if (process.env["EFFECTFUL_DEBUGGER_URL"] == null)
        env["EFFECTFUL_DEBUGGER_URL"] =
            `ws://${host}:${args.debuggerPort || 20011}`
      env["EFFECTFUL_DEBUGGER_OPEN"] = args.open ? String(args.open) : "0";
      env["EFFECTFUL_DEBUGGER_TIME_TRAVEL"] = args.timeTravel
        ? String(args.timeTravel)
        : "0";
      if (args.env) Object.assign(env, args.env);
      let term = this.supportsRunInTerminalRequest
        ? args.console
        : "internalConsole";
      if (term === true) term = "externalTerminal";
      else if (!term) term = "internalConsole";
      const reuse = args.reuse && term === "internalConsole";
      env["EFFECTFUL_DEBUGGER_EXTENSION_ROOT"] = path.resolve(__dirname, "..");
      if (args.preset === "node") {
        let node_path = DEBUGGER_PATHS;
        if (env.NODE_PATH) node_path += path.delimiter + env.NODE_PATH;
        env.NODE_PATH = node_path;
      } else if (args.preset === "browser") {
        if (args.indexJs) env.EFFECTFUL_DEBUGGER_INDEX_JS = args.indexJs;
        if (args.htmlTemplate)
          env.EFFECTFUL_DEBUGGER_HTML_TEMPLATE = args.htmlTemplate;
      }
      const cwd = args.cwd || (args.cwd = process.cwd());
      const launchArgs = [...(args.args || [])];
      let preset = args.preset;
      if (preset === true) preset = "node";
      let command = args.command;
      if (command === true) command = "";
      if (preset) {
        if (command.length) launchArgs.unshift(command);
        launchArgs.unshift(DEBUGGER_EDBG, preset);
        command = "node";
      }
      if (term === "externalTerminal" || term === "integratedTerminal") {
        const termArgs: P.RunInTerminalRequestArguments = {
          kind: term === "integratedTerminal" ? "integrated" : "external",
          title: "Effectful Debug Console",
          cwd,
          args: [command, ...launchArgs],
          env
        };
        this.runInTerminalRequest(
          termArgs,
          RUNINTERMINAL_TIMEOUT,
          runResponse => {
            // TODO: await termination
            if (!runResponse.success) {
              this.sendErrorResponse(
                response,
                1001,
                `Cannot launch debug target in terminal (${runResponse.message}).`
              );
              this.terminate("terminal error: " + runResponse.message);
            }
          }
        );
      } else {
        let child: ChildProcess | undefined;
        key = command;
        const timeTravel = args.timeTravel;
        if (reuse) {
          key = `${key}@${cwd}/${timeTravel}/${JSON.stringify(env)}`;
          child = runningCommands.get(key);
          //TODO: browser refresh
        }
        let startBuf: string[] = [];
        if (!child) {
          const spawnArgs: any = { cwd, env, shell: preset !== "browser"};
          if (args.argv0) spawnArgs.argv0 = args.argv0;
          child = spawn(command, launchArgs, spawnArgs);
          child.on("error", data => {
            this.sendErrorResponse(
              response,
              1001,
              `Cannot launch debug target in terminal (${data.message}).`
            );
            this.terminate("spawn error: " + data.message);
          });
          child.stdout.on("data", data => {
            const txt = String(data);
            console.error("DATA:",txt);
            if (preset === "browser")
              this.sendEvent(new OutputEvent(`webpack: ${txt}`, "stdout"));
            else if (args.verbose) logger.verbose(txt);
            if (!this.launched) startBuf.push(txt);
          });
          child.stderr.on("data", data => {
            const txt = String(data);
            console.error("EDATA:",txt);
            if (preset === "browser") {
              this.sendEvent(new OutputEvent(`webpack: ${txt}`, "stderr"));
            } else if (args.verbose) logger.error(txt);
            if (!this.launched) startBuf.push(txt);
          });
          child.on("exit", code => {
            if (!this.launched && startBuf.length) {
              errMessage = startBuf.join("");
            }
            logger.verbose(`command "${command}" exited with ${code}`);
            if (args.reuse && key) runningCommands.delete(key);
            this.closeRemote(0);
          });
          if (reuse && key) runningCommands.set(key, child);
          else this.childProcess = child;
        }
      }
    }
    if (!this.remotes.size) {
      this.showProgress("Awaiting a debuggee");
      await new Promise<Handler | undefined>(i => (this.connectCb = i));
      logger.verbose("first connection");
      this.connectCb = undefined;
      this.hideProgress();
    }
    if (this.remotes.size && !this.stopped) {
      // wait until configuration has finished (and configurationDoneRequest has been called)
      await Promise.race([
        new Promise(i => (this.configurationCb = i)),
        new Promise(i => setTimeout(i, CONFIGURATION_DONE_REQUEST_TIMEOUT))
      ]);
      logger.verbose("config done");
      for (const remote of this.remotes.values()) this.launchChild(remote);
    }
    if (this.stopped) {
      response.success = false;
      this.sendErrorResponse(
        response,
        1002,
        errMessage || "The application has stopped"
      );
      return;
    }
    this.launched = true;
    this.sendResponse(response);
  }

  private breakpointsSources = new Map<string | number, P.SourceBreakpoint[]>();
  private breakpointById = new Map<number, P.Breakpoint>();
  private breakpointsCount = 0;
  private breakpointsResponse?: P.SetBreakpointsResponse;

  private launchChild(remote: Handler): void {
    const args = this.launchArgs || {};
    logger.verbose(`launching {remote.id}...`);
    remote.send({
      command: "childLaunch",
      arguments: {
        threadId: remote.id,
        noDebug: args.noDebug,
        restart: args.__restart,
        stopOnEntry: args.stopOnEntry,
        dirSep: path.sep,
        exceptions: this.exceptionArgs,
        breakpoints: [...this.breakpointsSources].map(
          ([srcPath, breakpoints]) => ({
            breakpoints,
            source:
              typeof srcPath === "number"
                ? { sourceReference: srcPath }
                : { path: normalizeDrive(srcPath) }
          })
        )
      }
    });
  }

  protected doSetBreakpoints(req: P.SetBreakpointsRequest): void {
    const args = req.arguments;
    const srcPath: string | number =
      args.source.path || args.source.sourceReference || 0;
    if (args.source.path) args.source.path = normalizeDrive(args.source.path);
    // clear all breakpoints for this file
    const response = <P.SetBreakpointsResponse>new Response(req);
    const breakpoints: P.BreakpointInfo[] = [];
    response.body = { breakpoints };
    if (args.breakpoints) {
      for (const i of args.breakpoints) {
        const bp = {
          ...i,
          id: ++this.breakpointsCount,
          verified: false,
          source: args.source
        };
        breakpoints.push(bp);
        this.breakpointById.set(bp.id, bp);
      }
    }
    if (!breakpoints.length) this.breakpointsSources.delete(srcPath);
    else this.breakpointsSources.set(srcPath, breakpoints);
    if (this.remotes.size) {
      this.breakpointsResponse = response;
      for (const remote of this.remotes.values()) {
        remote.send({
          command: "childSetBreakpoints",
          seq: req.seq,
          arguments: {
            breakpoints,
            source: args.source,
            sourceModified: args.sourceModified
          }
        });
      }
    } else {
      this.sendResponse(response);
    }
  }

  protected convertResponseBreakpoints(
    bodyBreakpoints: P.BreakpointInfo[],
    isResponse?: boolean
  ): P.Breakpoint[] {
    // TODO: this arrives from many remotes
    const breakpoints: P.Breakpoint[] = [];
    for (let i of bodyBreakpoints) {
      if (i.id) {
        const b = this.breakpointById.get(i.id);
        if (b) {
          const sendEvent =
            !isResponse &&
            (i.line !== b.line ||
              i.verified !== b.verified ||
              i.message !== b.message);
          i = Object.assign(b, i);
          if (sendEvent) this.sendEvent(new BreakpointEvent("changed", i));
        }
      }
      breakpoints.push({
        id: i.id,
        verified: i.verified,
        message: i.message,
        source: i.source,
        line: i.line
      });
    }
    return breakpoints;
  }

  protected threadsRequest(response: P.ThreadsResponse): void {
    // runtime supports now threads so just return a default thread.
    response.body = {
      threads: [...this.remotes.keys()].map(
        id => new Thread(id, `thread ${id}`)
      )
    };

    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: P.DisconnectResponse,
    args: P.DisconnectArguments
  ): void {
    logger.verbose("preparing disconnect");
    this.stopped = true;
    if (this.configurationCb) this.configurationCb();
    super.disconnectRequest(response, args);
  }
}
