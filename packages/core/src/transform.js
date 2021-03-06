import * as Kit from "./kit";
import { Tag, consume, varScope } from "./kit";
import * as Loops from "./loops";
import * as State from "./state";
import * as Control from "./control";
import * as Scope from "./scope";
import * as Block from "./block";
import * as Bind from "./bind";
import * as Prop from "./propagate";
import * as Branch from "./branch";
import * as Exceptions from "./exceptions";
import * as Coerce from "./coerce";
import * as Policy from "./policy";
import * as Gens from "./generators";
import * as Rt from "./rt";
import * as Ops from "./operations";
import * as Flat from "./flat";
import * as Closure from "./closure";
import * as Inline from "./inline";
import * as Simplify from "./simplify";
import { ifLoose } from "./options";
import * as Par from "./par";
import * as Eval from "./eval";
import * as path from "path";

export const consumeScope = consume;

export const preproc = Kit.pipe(
  Policy.stage("scope-prepare"),
  Kit.scope.prepare,
  Policy.stage("scope"),
  Prop.prepare,
  Policy.stage("policy-scope"),
  Policy.prepare,
  Policy.stage("prepare"),
  Gens.prepare,
  Scope.arrowFunToBlock,
  Policy.unwrapNs,
  Policy.assignBindCalls,
  Policy.assignThrowEff,
  Policy.stage("propagate"),
  Control.assignLabels,
  Prop.propagateEff,
  State.prepare,
  Eval.prepare,
  Policy.stage("after-preproc")
);

/* default transform for all functions if loose mode is set */
export const loose = ifLoose(
  Kit.pipe(
    Kit.scope.prepare,
    Control.assignLabels,
    Policy.prepare,
    Policy.stage("prepareLoose"),
    Control.removeLabeledStatement,
    Loops.looseForOf,
    Control.restoreLabeledStatements,
    Rt.collectUsages,
    Kit.toArray,
    Simplify.blockScoping,
    Simplify.main,
    Policy.stage("finalize"),
    Rt.interpretLibSyms,
    Rt.inject
  )
);

const finalize = Kit.pipe(
  Policy.stage("finalize"),
  Closure.flattenModuleDecls,
  Closure.depsToTop,
  Scope.funcWraps,
  Closure.closConv,
  Policy.stage("meta"),
  Eval.injectMeta,
  Scope.injectMeta,
  Simplify.main,
  ifLoose(Loops.looseForOf),
  Control.restoreLabeledStatements,
  Policy.stage("symbols"),
  Rt.interpretLibSyms,
  Kit.toArray,
  Rt.inject,
  Policy.stage("after-finalize")
);

export const normalizeOnlyStage0 = Kit.map(
  Kit.pipe(
    Control.removeLabeledStatement,
    Loops.toBlocks,
    State.saveDecls,
    Kit.toArray
  )
);

export const normalizeOnlyStage1 = Kit.map(
  Kit.pipe(
    Branch.clean,
    State.restoreDecls,
    Closure.substContextIds,
    Kit.toArray
  )
);

/**
 * passes in required order depending on options specified
 */
export const stage0 = Kit.pipe(
  Kit.map(
    Kit.pipe(
      Policy.stage("before-stage0"),
      Gens.functionSentPrepare,
      Control.injectExplicitRet,
      Ops.inject,
      Coerce.jsx,
      Policy.stage("normalize"),
      Kit.toArray,
      Control.removeLabeledStatement,
      Loops.toBlocks,
      Loops.whileStmt,
      Loops.forOfStmt,
      Policy.resetOpts,
      Loops.doWhileStmt,
      Prop.recalcEff,
      Branch.normalizeSwitch,
      Prop.recalcEff,
      Branch.addAlternate,
      Branch.toBlocks,
      Policy.stage("after-normalize")
    )
  ),
  Loops.normalizeFor,
  Kit.map(
    Kit.pipe(
      Policy.stage("save-decls"),
      State.saveDecls,
      Prop.recalcEff,
      Coerce.lift,
      Policy.stage("blocks")
    )
  ),
  Control.injectBlock,
  Kit.map(
    Kit.pipe(
      Policy.stage("operations"),
      Ops.normalizeAssign,
      Ops.propAccess,
      Policy.stage("organize"),
      Prop.recalcEff,
      Bind.flatten,
      Par.markRegions,
      Policy.stage("inject"),
      Exceptions.inject,
      Prop.recalcEff,
      Block.splitEffBlock,
      Rt.replaceGlobals,
      Closure.convertCalls,
      Eval.wrap,
      Ops.combine,
      Policy.stage("flat-convert"),
      Flat.convert,
      Policy.stage("flat-form"),
      Inline.jsExceptions,
      Eval.substVars,
      Policy.stage("after-stage0")
    )
  )
);

const stage1 = Kit.pipe(
  Kit.map(
    Kit.pipe(
      Policy.stage("before-stage1"),
      Block.cleanPureEff,
      Policy.stage("interpret"),
      Ops.interpret,
      Policy.stage("interpret-flat"),
      Flat.interpret,
      Policy.stage("interpret-ops-inline"),
      Inline.ops,
      Coerce.inject,
      Policy.stage("interpret-app"),
      Block.interpretApp,
      Coerce.interpret,
      Policy.stage("interpretOps"),
      Block.interpretCasts,
      Policy.stage("interpret-clean"),
      Branch.clean,
      Policy.stage("restore-decls"),
      State.restoreDecls,
      Policy.stage("decls")
    )
  ),
  Array.from,
  Kit.map(
    Kit.pipe(
      Policy.stage("before-subst-sym"),
      substSym,
      Closure.substContextIds,
      Policy.stage("context"),
      Block.ctxMethods,
      Rt.collectUsages,
      Policy.stage("simplify"),
      Simplify.main,
      Policy.stage("after-stage1"),
      Kit.toArray,
      postproc
    )
  )
);

function postproc(sa) {
  const postproc = sa[0].value.postproc;
  if (postproc) for (const i of postproc) i();
  return sa;
}

/** replacing sym with `substSym` property if it is defined */
export function* substSym(si) {
  const s = Kit.auto(si);
  for (const i of s) {
    if (i.enter && i.type === Tag.Identifier && i.value.sym) {
      if (i.value.sym.substSym) i.value.sym = i.value.sym.substSym;
    }
    yield i;
  }
}

const dryRun = Kit.pipe(Control.removeLabeledStatement, Kit.toArray);

export function pass(s) {
  if (Policy.STATISTICS) performance.mark("full");
  const orig = Kit.toArray(s);
  let sa = Kit.toArray(Closure.topToIIFE(Rt.collectImports(orig)));
  const root = sa[0].value;
  let opts = root.opts || Kit.globalOpts();
  let rel;
  if (opts.file) {
    const root =
      opts.srcRoot === true ? opts.file.root || opts.file.cwd : opts.srcRoot;
    if (root) {
      rel = path.relative(path.dirname(opts.file.filename), root);
      if (Kit.isWindows) rel = rel.replace(/\\/g, "/");
      if (opts.detectRT && opts.detectRT.replace)
        opts.detectRT = opts.detectRT.replace("{ROOT}", rel);
      if (opts.importRT && opts.importRT.replace)
        opts.importRT = opts.importRT.replace("{ROOT}", rel);
    }
  }
  if (opts.detectRT) {
    if (!root.imports.has(opts.detectRT)) return null;
    opts.importRT = opts.detectRT;
  }
  sa = Kit.toArray(preproc(sa));
  if (!sa[0].value.$ns) return;

  const inp = Kit.toArray(Scope.splitScopes(sa));
  let scopeNum = 0;
  const len = inp.length;
  const inject = (root.injectRT = new Map());
  opts = root.opts;
  if (!opts) return null;
  if (opts.importRT && (opts.detectRT === false || !root.nsImported))
    inject.set(root.$ns, {
      module: opts.importRT,
      content: opts.inlineRT,
      ns: opts.importGlobal || opts.inlineRT ? null : root.$ns,
      usages: new Set()
    });
  const normalize = [];
  const transform = [];
  const others = [];
  for (const i of inp) i[0].value.track = i[0].value.track || i[0].value.topEff;
  /** even pure functions must be converted if they have shared vars */
  for (const i of inp) {
    const root = i[0].value;
    if (root.scopeDecls) {
      for (const j of root.scopeDecls) {
        if (j.interpr === Bind.ctxField) {
          root.track = true;
          if (j.refScopes) {
            for (const k of j.refScopes) {
              k.track = true;
              k.closure = true;
            }
          }
        }
      }
    }
  }
  let file = inp[len - 1];
  for (let x = 0; x < len - 1; ++x) {
    let i = inp[x];
    const { value } = i[0];
    value.scopeNum = scopeNum++;
    const f = value.opts;
    if (value.track) {
      value.injectRT = inject;
      value.$ns = root.$ns;
      if ((value.transform || f.transform) && value.topEff) transform.push(i);
      else normalize.push(i);
    } else others.push(i);
  }
  const hasEff = (root.hasEff = transform.length !== 0);
  if (!hasEff) {
    /** no transforms, but it may need to erase some directives */
    return loose(orig);
  }
  if (root.opts.topIIFE && root.hasESM)
    throw new Error(
      "`topIIFE:true` is incompatible with ES modules " +
        '(use "@babel/plugin-transform-modules-commonjs")'
    );
  if (normalize.length && root.opts.closConv)
    throw new Error("`closConv:true` requires all functions to be transformed");
  const s0 = [...stage0(transform)];
  const n0 = [...normalizeOnlyStage0(normalize)];
  const s1 = [...Closure.contextDecls(s0)];
  const n1 = [...Closure.contextDecls(n0)];
  /** loops for ofs-requires no labeled statements */
  let l1 = others;
  if (opts.loose) {
    l1 = l1.map(dryRun);
    file = dryRun(file);
  }
  const res = [...l1, ...stage1(s1), ...normalizeOnlyStage1(n1), file];
  const fin = finalize([...Scope.restore(root, res)]);
  if (Policy.STATISTICS) performance.measure("full", "full");
  return fin;
}

/**
 * entry point for the whole translator chain
 */
export function run(s) {
  const res = pass(s);
  if (!res) return;
  consume(varScope.resolve(res));
}

export function main(ast, opts = {}) {
  return Kit.optsScope(function main() {
    Kit.setOpts(opts);
    run(Kit.produce(ast));
    return ast;
  });
}
export function applyPass(ast, pass, opts = {}) {
  return Kit.optsScope(function applyPass() {
    Kit.setOpts(opts);
    pass(Kit.produce(ast));
    return ast;
  });
}

export default main;
