require("@babel/register")({ extensions: [".ts", ".js"] });
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.CustomEvent = dom.window.CustomEvent;
global.EventTarget = dom.window.EventTarget;
global.Element = dom.window.Element;
global.Document = dom.window.Document;
global.CSSStyleDeclaration = dom.window.CSSStyleDeclaration;
global.Comment = dom.window.Comment;
global.Document = dom.window.Document;
global.ProcessingInstruction = dom.window.ProcessingInstruction;
global.Text = dom.window.Text;
global.NodeList = dom.window.NodeList;
global.NamedNodeMap = dom.window.NamedNodeMap;
