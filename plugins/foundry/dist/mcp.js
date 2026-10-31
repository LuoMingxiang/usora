#!/usr/bin/env node
import { createRequire } from "node:module";
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS((exports) => {
  var ALIAS = Symbol.for("yaml.alias");
  var DOC = Symbol.for("yaml.document");
  var MAP = Symbol.for("yaml.map");
  var PAIR = Symbol.for("yaml.pair");
  var SCALAR = Symbol.for("yaml.scalar");
  var SEQ = Symbol.for("yaml.seq");
  var NODE_TYPE = Symbol.for("yaml.node.type");
  var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
  exports.ALIAS = ALIAS;
  exports.DOC = DOC;
  exports.MAP = MAP;
  exports.NODE_TYPE = NODE_TYPE;
  exports.PAIR = PAIR;
  exports.SCALAR = SCALAR;
  exports.SEQ = SEQ;
  exports.hasAnchor = hasAnchor;
  exports.isAlias = isAlias;
  exports.isCollection = isCollection;
  exports.isDocument = isDocument;
  exports.isMap = isMap;
  exports.isNode = isNode;
  exports.isPair = isPair;
  exports.isScalar = isScalar;
  exports.isSeq = isSeq;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/visit.js
var require_visit = __commonJS((exports) => {
  var identity = require_identity();
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path19) {
    const ctrl = callVisitor(key, node, visitor, path19);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path19, ctrl);
      return visit_(key, ctrl, visitor, path19);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path19 = Object.freeze(path19.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = visit_(i, node.items[i], visitor, path19);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path19 = Object.freeze(path19.concat(node));
        const ck = visit_("key", node.key, visitor, path19);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path19);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path19) {
    const ctrl = await callVisitor(key, node, visitor, path19);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path19, ctrl);
      return visitAsync_(key, ctrl, visitor, path19);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path19 = Object.freeze(path19.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = await visitAsync_(i, node.items[i], visitor, path19);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path19 = Object.freeze(path19.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path19);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path19);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path19) {
    if (typeof visitor === "function")
      return visitor(key, node, path19);
    if (identity.isMap(node))
      return visitor.Map?.(key, node, path19);
    if (identity.isSeq(node))
      return visitor.Seq?.(key, node, path19);
    if (identity.isPair(node))
      return visitor.Pair?.(key, node, path19);
    if (identity.isScalar(node))
      return visitor.Scalar?.(key, node, path19);
    if (identity.isAlias(node))
      return visitor.Alias?.(key, node, path19);
    return;
  }
  function replaceNode(key, path19, node) {
    const parent = path19[path19.length - 1];
    if (identity.isCollection(parent)) {
      parent.items[key] = node;
    } else if (identity.isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (identity.isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = identity.isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }
  exports.visit = visit;
  exports.visitAsync = visitAsync;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  var escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);

  class Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
      const copy = new Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    atDocument() {
      const res = new Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, Directives.defaultTags);
          break;
      }
      return res;
    }
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
        const tags = {};
        visit.visit(doc.contents, (_key, node) => {
          if (identity.isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join(`
`);
    }
  }
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
  exports.Directives = Directives;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors = new Set;
    visit.visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors.add(node.anchor);
      }
    });
    return anchors;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i = 1;; ++i) {
      const name = `${prefix}${i}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = new Map;
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        prevAnchors ?? (prevAnchors = anchorNames(doc));
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }
  exports.anchorIsValid = anchorIsValid;
  exports.anchorNames = anchorNames;
  exports.createNodeAnchors = createNodeAnchors;
  exports.findNewAnchor = findNewAnchor;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS((exports) => {
  function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0, len = val.length;i < len; ++i) {
          const v0 = val[i];
          const v1 = applyReviver(reviver, val, String(i), v0);
          if (v1 === undefined)
            delete val[i];
          else if (v1 !== v0)
            val[i] = v1;
        }
      } else if (val instanceof Map) {
        for (const k of Array.from(val.keys())) {
          const v0 = val.get(k);
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === undefined)
            val.delete(k);
          else if (v1 !== v0)
            val.set(k, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver(reviver, val, v0, v0);
          if (v1 === undefined)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k, v0] of Object.entries(val)) {
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === undefined)
            delete val[k];
          else if (v1 !== v0)
            val[k] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }
  exports.applyReviver = applyReviver;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS((exports) => {
  var identity = require_identity();
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !identity.hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: undefined };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }
  exports.toJS = toJS;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS((exports) => {
  var applyReviver = require_applyReviver();
  var identity = require_identity();
  var toJS = require_toJS();

  class NodeBase {
    constructor(type) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: type });
    }
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!identity.isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: new Map,
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
  }
  exports.NodeBase = NodeBase;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS((exports) => {
  var anchors = require_anchors();
  var visit = require_visit();
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();

  class Alias extends Node.NodeBase {
    constructor(source) {
      super(identity.ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    resolve(doc, ctx) {
      if (ctx?.maxAliasCount === 0)
        throw new ReferenceError("Alias resolution is disabled");
      let nodes;
      if (ctx?.aliasResolveCache) {
        nodes = ctx.aliasResolveCache;
      } else {
        nodes = [];
        visit.visit(doc, {
          Node: (_key, node) => {
            if (identity.isAlias(node) || identity.hasAnchor(node))
              nodes.push(node);
          }
        });
        if (ctx)
          ctx.aliasResolveCache = nodes;
      }
      let found = undefined;
      for (const node of nodes) {
        if (node === this)
          break;
        if (node.anchor === this.source)
          found = node;
      }
      if (found && ctx) {
        const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
        let data = anchors2.get(found);
        if (!data) {
          toJS.toJS(found, null, ctx);
          data = anchors2.get(found);
        }
        if (data?.res === undefined) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc2, found, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
      }
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const source = this.resolve(ctx.doc, ctx);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      return ctx.anchors.get(source).res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchors.anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  }
  function getAliasCount(doc, node, anchors2) {
    if (identity.isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors2 && source && anchors2.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (identity.isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c = getAliasCount(doc, item, anchors2);
        if (c > count)
          count = c;
      }
      return count;
    } else if (identity.isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors2);
      const vc = getAliasCount(doc, node.value, anchors2);
      return Math.max(kc, vc);
    }
    return 1;
  }
  exports.Alias = Alias;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();
  var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";

  class Scalar extends Node.NodeBase {
    constructor(value) {
      super(identity.SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  }
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
  exports.Scalar = Scalar;
  exports.isScalarValue = isScalarValue;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode(value, tagName, ctx) {
    if (identity.isDocument(value))
      value = value.contents;
    if (identity.isNode(value))
      return value;
    if (identity.isPair(value)) {
      const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
      map.items.push(value);
      return map;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
    let ref = undefined;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        ref.anchor ?? (ref.anchor = onAnchor(value));
        return new Alias.Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar.Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema[identity.MAP] : (Symbol.iterator in Object(value)) ? schema[identity.SEQ] : schema[identity.MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }
  exports.createNode = createNode;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS((exports) => {
  var createNode = require_createNode();
  var identity = require_identity();
  var Node = require_Node();
  function collectionFromPath(schema, path19, value) {
    let v = value;
    for (let i = path19.length - 1;i >= 0; --i) {
      const k = path19[i];
      if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
        const a = [];
        a[k] = v;
        v = a;
      } else {
        v = new Map([[k, v]]);
      }
    }
    return createNode.createNode(v, undefined, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema,
      sourceObjects: new Map
    });
  }
  var isEmptyPath = (path19) => path19 == null || typeof path19 === "object" && !!path19[Symbol.iterator]().next().done;

  class Collection extends Node.NodeBase {
    constructor(type, schema) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    clone(schema) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema)
        copy.schema = schema;
      copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    addIn(path19, value) {
      if (isEmptyPath(path19))
        this.add(value);
      else {
        const [key, ...rest] = path19;
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.addIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    deleteIn(path19) {
      const [key, ...rest] = path19;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (identity.isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    getIn(path19, keepScalar) {
      const [key, ...rest] = path19;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && identity.isScalar(node) ? node.value : node;
      else
        return identity.isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!identity.isPair(node))
          return false;
        const n = node.value;
        return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }
    hasIn(path19) {
      const [key, ...rest] = path19;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return identity.isCollection(node) ? node.hasIn(rest) : false;
    }
    setIn(path19, value) {
      const [key, ...rest] = path19;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.setIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  }
  exports.Collection = Collection;
  exports.collectionFromPath = collectionFromPath;
  exports.isEmptyPath = isEmptyPath;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS((exports) => {
  var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  var lineComment = (str, indent, comment) => str.endsWith(`
`) ? indentComment(comment, indent) : comment.includes(`
`) ? `
` + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
  exports.indentComment = indentComment;
  exports.lineComment = lineComment;
  exports.stringifyComment = stringifyComment;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS((exports) => {
  var FOLD_FLOW = "flow";
  var FOLD_BLOCK = "block";
  var FOLD_QUOTED = "quoted";
  function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text2;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text2.length <= endStep)
      return text2;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text2, i, indent.length);
      if (i !== -1)
        end = i + endStep;
    }
    for (let ch;ch = text2[i += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i;
        switch (text2[i + 1]) {
          case "x":
            i += 3;
            break;
          case "u":
            i += 5;
            break;
          case "U":
            i += 9;
            break;
          default:
            i += 1;
        }
        escEnd = i;
      }
      if (ch === `
`) {
        if (mode === FOLD_BLOCK)
          i = consumeMoreIndentedLines(text2, i, indent.length);
        end = i + indent.length + endStep;
        split = undefined;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== `
` && prev !== "\t") {
          const next = text2[i + 1];
          if (next && next !== " " && next !== `
` && next !== "\t")
            split = i;
        }
        if (i >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = undefined;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "\t") {
              prev = ch;
              ch = text2[i += 1];
              overflow = true;
            }
            const j = i > escEnd + 1 ? i - 2 : escStart - 1;
            if (escapedFolds[j])
              return text2;
            folds.push(j);
            escapedFolds[j] = true;
            end = j + endStep;
            split = undefined;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text2;
    if (onFold)
      onFold();
    let res = text2.slice(0, folds[0]);
    for (let i2 = 0;i2 < folds.length; ++i2) {
      const fold = folds[i2];
      const end2 = folds[i2 + 1] || text2.length;
      if (fold === 0)
        res = `
${indent}${text2.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text2[fold]}\\`;
        res += `
${indent}${text2.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text2, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text2[start];
    while (ch === " " || ch === "\t") {
      if (i < start + indent) {
        ch = text2[++i];
      } else {
        do {
          ch = text2[++i];
        } while (ch && ch !== `
`);
        end = i;
        start = i + 1;
        ch = text2[start];
      }
    }
    return end;
  }
  exports.FOLD_BLOCK = FOLD_BLOCK;
  exports.FOLD_FLOW = FOLD_FLOW;
  exports.FOLD_QUOTED = FOLD_QUOTED;
  exports.foldFlowLines = foldFlowLines;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var foldFlowLines = require_foldFlowLines();
  var getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i = 0, start = 0;i < strLen; ++i) {
      if (str[i] === `
`) {
        if (i - start > limit)
          return true;
        start = i + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i = 0, ch = json[i];ch; ch = json[++i]) {
      if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
        str += json.slice(start, i) + "\\ ";
        i += 1;
        start = i;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i + 1]) {
          case "u":
            {
              str += json.slice(start, i);
              const code = json.substr(i + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i, 6);
              }
              i += 5;
              start = i + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
              i += 1;
            } else {
              str += json.slice(start, i) + `

`;
              while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                str += `
`;
                i += 2;
              }
              str += indent;
              if (json[i + 2] === " ")
                str += "\\";
              i += 1;
              start = i + 1;
            }
            break;
          default:
            i += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes(`
`) || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  var blockEndNewlines;
  try {
    blockEndNewlines = new RegExp(`(^|(?<!
))
+(?!
|$)`, "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? `|
` : `>
`;
    let chomp;
    let endStart;
    for (endStart = value.length;endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== `
` && ch !== "\t" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf(`
`);
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === `
`)
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0;startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === `
`)
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, `
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes(`
`) || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes(`
`) ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes(`
`)) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.Scalar.BLOCK_FOLDED:
        case Scalar.Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }
  exports.stringifyString = stringifyString;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS((exports) => {
  var anchors = require_anchors();
  var identity = require_identity();
  var stringifyComment = require_stringifyComment();
  var stringifyString = require_stringifyString();
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment.stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trailingComma: false,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: new Set,
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item) {
    if (item.tag) {
      const match = tags.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = undefined;
    let obj;
    if (identity.isScalar(item)) {
      obj = item.value;
      let match = tags.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
    if (anchor && anchors.anchorIsValid(anchor)) {
      anchors$1.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item, ctx, onComment, onChompKeep) {
    if (identity.isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (identity.isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if (ctx.resolvedAliases?.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = undefined;
    const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }
  exports.createStringifyContext = createStringifyContext;
  exports.stringify = stringify;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = identity.isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity.isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity.isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? `
` : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === `
` && valueComment)
          ws = `

`;
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && identity.isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf(`
`);
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === `
`) {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }
  exports.stringifyPair = stringifyPair;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/log.js
var require_log = __commonJS((exports) => {
  var node_process = __require("process");
  function debug(logLevel, ...messages) {
    if (logLevel === "debug")
      console.log(...messages);
  }
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      if (typeof node_process.emitWarning === "function")
        node_process.emitWarning(warning);
      else
        console.warn(warning);
    }
  }
  exports.debug = debug;
  exports.warn = warn;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var MERGE_KEY = "<<";
  var merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
  function addMergeToJSMap(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (identity.isSeq(source))
      for (const it of source.items)
        mergeValue(ctx, map, it);
    else if (Array.isArray(source))
      for (const it of source)
        mergeValue(ctx, map, it);
    else
      mergeValue(ctx, map, source);
  }
  function mergeValue(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (!identity.isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map instanceof Map) {
        if (!map.has(key))
          map.set(key, value2);
      } else if (map instanceof Set) {
        map.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
        Object.defineProperty(map, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map;
  }
  function resolveAliasValue(ctx, value) {
    return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
  }
  exports.addMergeToJSMap = addMergeToJSMap;
  exports.isMergeKey = isMergeKey;
  exports.merge = merge;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS((exports) => {
  var log = require_log();
  var merge = require_merge();
  var stringify = require_stringify();
  var identity = require_identity();
  var toJS = require_toJS();
  function addPairToJSMap(ctx, map, { key, value }) {
    if (identity.isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map, value);
    else if (merge.isMergeKey(ctx, key))
      merge.addMergeToJSMap(ctx, map, value);
    else {
      const jsKey = toJS.toJS(key, "", ctx);
      if (map instanceof Map) {
        map.set(jsKey, toJS.toJS(value, jsKey, ctx));
      } else if (map instanceof Set) {
        map.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS.toJS(value, stringKey, ctx);
        if (stringKey in map)
          Object.defineProperty(map, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map[stringKey] = jsValue;
      }
    }
    return map;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (identity.isNode(key) && ctx?.doc) {
      const strCtx = stringify.createStringifyContext(ctx.doc, {});
      strCtx.anchors = new Set;
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }
  exports.addPairToJSMap = addPairToJSMap;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyPair = require_stringifyPair();
  var addPairToJSMap = require_addPairToJSMap();
  var identity = require_identity();
  function createPair(key, value, ctx) {
    const k = createNode.createNode(key, undefined, ctx);
    const v = createNode.createNode(value, undefined, ctx);
    return new Pair(k, v);
  }

  class Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema) {
      let { key, value } = this;
      if (identity.isNode(key))
        key = key.clone(schema);
      if (identity.isNode(value))
        value = value.clone(schema);
      return new Pair(key, value);
    }
    toJSON(_, ctx) {
      const pair = ctx?.mapAsMap ? new Map : {};
      return addPairToJSMap.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  }
  exports.Pair = Pair;
  exports.createPair = createPair;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyCollection(collection2, ctx, options) {
    const flow = ctx.inFlow ?? collection2.flow;
    const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify2(collection2, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment2 = null;
      if (identity.isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment2 = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i = 1;i < lines.length; ++i) {
        const line = lines[i];
        str += line ? `
${indent}${line}` : `
`;
      }
    }
    if (comment) {
      str += `
` + stringifyComment.indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment = null;
      if (identity.isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = identity.isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify.stringify(item, itemCtx, () => comment = null);
      reqNewline || (reqNewline = lines.length > linesAtValue || str.includes(`
`));
      if (i < items.length - 1) {
        str += ",";
      } else if (ctx.options.trailingComma) {
        if (ctx.options.lineWidth > 0) {
          reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
        }
        if (reqNewline) {
          str += ",";
        }
      }
      if (comment)
        str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : `
`;
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = stringifyComment.indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }
  exports.stringifyCollection = stringifyCollection;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS((exports) => {
  var stringifyCollection = require_stringifyCollection();
  var addPairToJSMap = require_addPairToJSMap();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  function findPair(items, key) {
    const k = identity.isScalar(key) ? key.value : key;
    for (const it of items) {
      if (identity.isPair(it)) {
        if (it.key === key || it.key === k)
          return it;
        if (identity.isScalar(it.key) && it.key.value === k)
          return it;
      }
    }
    return;
  }

  class YAMLMap extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema) {
      super(identity.MAP, schema);
      this.items = [];
    }
    static from(schema, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map = new this(schema);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== undefined || keepUndefined)
          map.items.push(Pair.createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema.sortMapEntries === "function") {
        map.items.sort(schema.sortMapEntries);
      }
      return map;
    }
    add(pair, overwrite) {
      let _pair;
      if (identity.isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair.Pair(pair, pair?.value);
      } else
        _pair = new Pair.Pair(pair.key, pair.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i === -1)
          this.items.push(_pair);
        else
          this.items.splice(i, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? undefined;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair.Pair(key, value), true);
    }
    toJSON(_, ctx, Type) {
      const map = Type ? new Type : ctx?.mapAsMap ? new Map : {};
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const item of this.items)
        addPairToJSMap.addPairToJSMap(ctx, map, item);
      return map;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!identity.isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  }
  exports.YAMLMap = YAMLMap;
  exports.findPair = findPair;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLMap = require_YAMLMap();
  var map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap.YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!identity.isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
  };
  exports.map = map;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyCollection = require_stringifyCollection();
  var Collection = require_Collection();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var toJS = require_toJS();

  class YAMLSeq extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema) {
      super(identity.SEQ, schema);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return;
      const it = this.items[idx];
      return !keepScalar && identity.isScalar(it) ? it.value : it;
    }
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (identity.isScalar(prev) && Scalar.isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq);
      let i = 0;
      for (const item of this.items)
        seq.push(toJS.toJS(item, String(i++), ctx));
      return seq;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema, obj, ctx) {
      const { replacer } = ctx;
      const seq = new this(schema);
      if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i++);
            it = replacer.call(obj, key, it);
          }
          seq.items.push(createNode.createNode(it, undefined, ctx));
        }
      }
      return seq;
    }
  }
  function asItemIndex(key) {
    let idx = identity.isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }
  exports.YAMLSeq = YAMLSeq;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLSeq = require_YAMLSeq();
  var seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!identity.isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
  };
  exports.seq = seq;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS((exports) => {
  var stringifyString = require_stringifyString();
  var string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
    }
  };
  exports.string = string;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar.Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };
  exports.nullTag = nullTag;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };
  exports.boolTag = boolTag;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS((exports) => {
  function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
      let i = n.indexOf(".");
      if (i < 0) {
        i = n.length;
        n += ".";
      }
      let d = minFractionDigits - (n.length - i - 1);
      while (d-- > 0)
        n += "0";
    }
    return n;
  }
  exports.stringifyNumber = stringifyNumber;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber.stringifyNumber(node);
  }
  var intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.boolTag,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float
  ];
  exports.schema = schema;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var map = require_map();
  var seq = require_seq();
  function intIdentify(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  var stringifyJSON = ({ value }) => JSON.stringify(value);
  var jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  var jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
  exports.schema = schema;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS((exports) => {
  var node_buffer = __require("buffer");
  var Scalar = require_Scalar();
  var stringifyString = require_stringifyString();
  var binary = {
    identify: (value) => value instanceof Uint8Array,
    default: false,
    tag: "tag:yaml.org,2002:binary",
    resolve(src, onError) {
      if (typeof node_buffer.Buffer === "function") {
        return node_buffer.Buffer.from(src, "base64");
      } else if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i = 0;i < str.length; ++i)
          buffer[i] = str.charCodeAt(i);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      if (!value)
        return "";
      const buf = value;
      let str;
      if (typeof node_buffer.Buffer === "function") {
        str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
      } else if (typeof btoa === "function") {
        let s = "";
        for (let i = 0;i < buf.length; ++i)
          s += String.fromCharCode(buf[i]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n = Math.ceil(str.length / lineWidth);
        const lines = new Array(n);
        for (let i = 0, o = 0;i < n; ++i, o += lineWidth) {
          lines[i] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? `
` : " ");
      }
      return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };
  exports.binary = binary;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  var YAMLSeq = require_YAMLSeq();
  function resolvePairs(seq, onError) {
    if (identity.isSeq(seq)) {
      for (let i = 0;i < seq.items.length; ++i) {
        let item = seq.items[i];
        if (identity.isPair(item))
          continue;
        else if (identity.isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq;
  }
  function createPairs(schema, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq.YAMLSeq(schema);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(Pair.createPair(key, value, ctx));
      }
    return pairs2;
  }
  var pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };
  exports.createPairs = createPairs;
  exports.pairs = pairs;
  exports.resolvePairs = resolvePairs;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS((exports) => {
  var identity = require_identity();
  var toJS = require_toJS();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var pairs = require_pairs();

  class YAMLOMap extends YAMLSeq.YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
      this.tag = YAMLOMap.tag;
    }
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map = new Map;
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const pair of this.items) {
        let key, value;
        if (identity.isPair(pair)) {
          key = toJS.toJS(pair.key, "", ctx);
          value = toJS.toJS(pair.value, key, ctx);
        } else {
          key = toJS.toJS(pair, "", ctx);
        }
        if (map.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map.set(key, value);
      }
      return map;
    }
    static from(schema, iterable, ctx) {
      const pairs$1 = pairs.createPairs(schema, iterable, ctx);
      const omap2 = new this;
      omap2.items = pairs$1.items;
      return omap2;
    }
  }
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  var omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq, onError) {
      const pairs$1 = pairs.resolvePairs(seq, onError);
      const seenKeys = [];
      for (const { key } of pairs$1.items) {
        if (identity.isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap, pairs$1);
    },
    createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
  };
  exports.YAMLOMap = YAMLOMap;
  exports.omap = omap;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  var trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar.Scalar(true),
    stringify: boolStringify
  };
  var falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar.Scalar(false),
    stringify: boolStringify
  };
  exports.falseTag = falseTag;
  exports.trueTag = trueTag;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f = str.substring(dot + 1).replace(/_/g, "");
        if (f[f.length - 1] === "0")
          node.minFractionDigits = f.length;
      }
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n2 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n2 : n2;
    }
    const n = parseInt(str, radix);
    return sign === "-" ? -1 * n : n;
  }
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber.stringifyNumber(node);
  }
  var intBin = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: (node) => intStringify(node, 2, "0b")
  };
  var intOct = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: (node) => intStringify(node, 8, "0")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intBin = intBin;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();

  class YAMLSet extends YAMLMap.YAMLMap {
    constructor(schema) {
      super(schema);
      this.tag = YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (identity.isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair.Pair(key.key, null);
      else
        pair = new Pair.Pair(key, null);
      const prev = YAMLMap.findPair(this.items, pair.key);
      if (!prev)
        this.items.push(pair);
    }
    get(key, keepPair) {
      const pair = YAMLMap.findPair(this.items, key);
      return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = YAMLMap.findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair.Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(Pair.createPair(value, null, ctx));
        }
      return set2;
    }
  }
  YAMLSet.tag = "tag:yaml.org,2002:set";
  var set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
    resolve(map, onError) {
      if (identity.isMap(map)) {
        if (map.hasAllNullValues(true))
          return Object.assign(new YAMLSet, map);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map;
    }
  };
  exports.YAMLSet = YAMLSet;
  exports.set = set;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === "bigint")
      num = (n) => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber.stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  var intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  var floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  var timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})" + "(?:" + "(?:t|T|[ \\t]+)" + "([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)" + "(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?" + ")?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 60000 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
  };
  exports.floatTime = floatTime;
  exports.intTime = intTime;
  exports.timestamp = timestamp;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var binary = require_binary();
  var bool = require_bool2();
  var float = require_float2();
  var int = require_int2();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var set = require_set();
  var timestamp = require_timestamp();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.trueTag,
    bool.falseTag,
    int.intBin,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float,
    binary.binary,
    merge.merge,
    omap.omap,
    pairs.pairs,
    set.set,
    timestamp.intTime,
    timestamp.floatTime,
    timestamp.timestamp
  ];
  exports.schema = schema;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = require_schema();
  var schema$1 = require_schema2();
  var binary = require_binary();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var schema$2 = require_schema3();
  var set = require_set();
  var timestamp = require_timestamp();
  var schemas = new Map([
    ["core", schema.schema],
    ["failsafe", [map.map, seq.seq, string.string]],
    ["json", schema$1.schema],
    ["yaml11", schema$2.schema],
    ["yaml-1.1", schema$2.schema]
  ]);
  var tagsByName = {
    binary: binary.binary,
    bool: bool.boolTag,
    float: float.float,
    floatExp: float.floatExp,
    floatNaN: float.floatNaN,
    floatTime: timestamp.floatTime,
    int: int.int,
    intHex: int.intHex,
    intOct: int.intOct,
    intTime: timestamp.intTime,
    map: map.map,
    merge: merge.merge,
    null: _null.nullTag,
    omap: omap.omap,
    pairs: pairs.pairs,
    seq: seq.seq,
    set: set.set,
    timestamp: timestamp.timestamp
  };
  var coreKnownTags = {
    "tag:yaml.org,2002:binary": binary.binary,
    "tag:yaml.org,2002:merge": merge.merge,
    "tag:yaml.org,2002:omap": omap.omap,
    "tag:yaml.org,2002:pairs": pairs.pairs,
    "tag:yaml.org,2002:set": set.set,
    "tag:yaml.org,2002:timestamp": timestamp.timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge.merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }
  exports.coreKnownTags = coreKnownTags;
  exports.getTags = getTags;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS((exports) => {
  var identity = require_identity();
  var map = require_map();
  var seq = require_seq();
  var string = require_string();
  var tags = require_tags();
  var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

  class Schema {
    constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
      this.name = typeof schema === "string" && schema || "core";
      this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
      this.tags = tags.getTags(customTags, this.name, merge);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, identity.MAP, { value: map.map });
      Object.defineProperty(this, identity.SCALAR, { value: string.string });
      Object.defineProperty(this, identity.SEQ, { value: seq.seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  }
  exports.Schema = Schema;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = stringify.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(stringifyComment.indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (identity.isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(stringifyComment.indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? undefined : () => chompKeep = true;
      let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += stringifyComment.lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes(`
`)) {
          lines.push("...");
          lines.push(stringifyComment.indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(stringifyComment.indentComment(commentString(dc), ""));
      }
    }
    return lines.join(`
`) + `
`;
  }
  exports.stringifyDocument = stringifyDocument;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS((exports) => {
  var Alias = require_Alias();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var toJS = require_toJS();
  var Schema = require_Schema();
  var stringifyDocument = require_stringifyDocument();
  var anchors = require_anchors();
  var applyReviver = require_applyReviver();
  var createNode = require_createNode();
  var directives = require_directives();

  class Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new directives.Directives({ version });
      this.setSchema(version, options);
      this.contents = value === undefined ? null : this.createNode(value, _replacer, options);
    }
    clone() {
      const copy = Object.create(Document.prototype, {
        [identity.NODE_TYPE]: { value: identity.DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    addIn(path19, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path19, value);
    }
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchors.anchorNames(this);
        node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
      }
      return new Alias.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = undefined;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode.createNode(value, tag, ctx);
      if (flow && identity.isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    createPair(key, value, options = {}) {
      const k = this.createNode(key, null, options);
      const v = this.createNode(value, null, options);
      return new Pair.Pair(k, v);
    }
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    deleteIn(path19) {
      if (Collection.isEmptyPath(path19)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path19) : false;
    }
    get(key, keepScalar) {
      return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : undefined;
    }
    getIn(path19, keepScalar) {
      if (Collection.isEmptyPath(path19))
        return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
      return identity.isCollection(this.contents) ? this.contents.getIn(path19, keepScalar) : undefined;
    }
    has(key) {
      return identity.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    hasIn(path19) {
      if (Collection.isEmptyPath(path19))
        return this.contents !== undefined;
      return identity.isCollection(this.contents) ? this.contents.hasIn(path19) : false;
    }
    set(key, value) {
      if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    setIn(path19, value) {
      if (Collection.isEmptyPath(path19)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, Array.from(path19), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path19, value);
      }
    }
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new directives.Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new directives.Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema.Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: new Map,
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument.stringifyDocument(this, options);
    }
  }
  function assertCollection(contents) {
    if (identity.isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }
  exports.Document = Document;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/errors.js
var require_errors = __commonJS((exports) => {
  class YAMLError extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  }

  class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  }

  class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  }
  var prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "…" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "…";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + `…
`;
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end?.line === line && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer}
`;
    }
  };
  exports.YAMLError = YAMLError;
  exports.YAMLParseError = YAMLParseError;
  exports.YAMLWarning = YAMLWarning;
  exports.prettifyError = prettifyError;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS((exports) => {
  function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("\t")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else if (!found || indicator !== "seq-item-ind")
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }
  exports.resolveProps = resolveProps;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS((exports) => {
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes(`
`))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }
  exports.containsNewline = containsNewline;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS((exports) => {
  var utilContainsNewline = require_util_contains_newline();
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }
  exports.flowIndentCheck = flowIndentCheck;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS((exports) => {
  var identity = require_identity();
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
    return items.some((pair) => isEqual(pair.key, search));
  }
  exports.mapIncludes = mapIncludes;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS((exports) => {
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  var utilMapIncludes = require_util_map_includes();
  var startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
    const map = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps.resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map.comment)
              map.comment += `
` + keyProps.comment;
            else
              map.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps.resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map.range = [bm.offset, offset, commentEnd ?? offset];
    return map;
  }
  exports.resolveBlockMap = resolveBlockMap;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS((exports) => {
  var YAMLSeq = require_YAMLSeq();
  var resolveProps = require_resolve_props();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
    const seq = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps.resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value?.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq.items.push(node);
    }
    seq.range = [bs.offset, offset, commentEnd ?? offset];
    return seq;
  }
  exports.resolveBlockSeq = resolveBlockSeq;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS((exports) => {
  function resolveEnd(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }
  exports.resolveEnd = resolveEnd;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilMapIncludes = require_util_map_includes();
  var blockMsg = "Block collections are not allowed within flow collections";
  var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === "{";
    const fcName = isMap ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0;i < fc.items.length; ++i) {
      const collItem = fc.items[i];
      const { start, key, sep, value } = collItem;
      const props = resolveProps.resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += `
` + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
          onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
      }
      if (i === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop:
            for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (identity.isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += `
` + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap && !sep && !props.found) {
        const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source?.[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap) {
          const map = coll;
          if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map.items.push(pair);
        } else {
          const map = new YAMLMap.YAMLMap(ctx.schema);
          map.flow = true;
          map.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += `
` + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }
  exports.resolveFlowCollection = resolveFlowCollection;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveBlockMap = require_resolve_block_map();
  var resolveBlockSeq = require_resolve_block_seq();
  var resolveFlowCollection = require_resolve_flow_collection();
  function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt?.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }
  exports.composeCollection = composeCollection;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i = lines.length - 1;i >= 0; --i) {
      const content = lines[i][1];
      if (content === "" || content === "\r")
        chompStart = i;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? `
`.repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar.source)
        end2 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0;i < chompStart; ++i) {
      const [indent, content] = lines[i];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i = lines.length - 1;i >= chompStart; --i) {
      if (lines[i][0].length > trimIndent)
        chompStart = i + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i = 0;i < contentStart; ++i)
      value += lines[i][0].slice(trimIndent) + `
`;
    for (let i = contentStart;i < chompStart; ++i) {
      let [indent, content] = lines[i];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
      } else if (indent.length > trimIndent || content[0] === "\t") {
        if (sep === " ")
          sep = `
`;
        else if (!prevMoreIndented && sep === `
`)
          sep = `

`;
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === `
`)
          value += `
`;
        else
          sep = `
`;
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i = chompStart;i < lines.length; ++i)
          value += `
` + lines[i][0].slice(trimIndent);
        if (value[value.length - 1] !== `
`)
          value += `
`;
        break;
      default:
        value += `
`;
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i = 1;i < source.length; ++i) {
      const ch = source[i];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n = Number(ch);
        if (!indent && n)
          indent = n;
        else if (error === -1)
          error = offset + i;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i = 1;i < props.length; ++i) {
      const token = props[i];
      switch (token.type) {
        case "space":
          hasSpace = true;
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
    const lines = [line0];
    for (let i = 1;i < split.length; i += 2)
      lines.push([split[i], split[i + 1]]);
    return lines;
  }
  exports.resolveBlockScalar = resolveBlockScalar;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var resolveEnd = require_resolve_end();
  function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      case "\t":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return unfoldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function unfoldLines(source) {
    const line = /(.*?)\r?\n/sy;
    let match = line.exec(source);
    if (!match)
      return source;
    let trimEnd, trimBoth;
    try {
      trimEnd = new RegExp("(?<![ \t])[ \t]+$");
      trimBoth = new RegExp("^[ \t]+|(?<![ \t])[ \t]+$", "g");
    } catch {
      trimEnd = /[ \t]+$/;
      trimBoth = /^[ \t]+|[ \t]+$/g;
    }
    let res = match[1].replace(trimEnd, "");
    let sep = " ";
    let pos = line.lastIndex;
    while (match = line.exec(source)) {
      const lm = match[1].replace(trimBoth, "");
      if (lm === "") {
        if (sep === `
`)
          res += sep;
        else
          sep = `
`;
      } else {
        res += sep + lm;
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i = 1;i < source.length - 1; ++i) {
      const ch = source[i];
      if (ch === "\r" && source[i + 1] === `
`)
        continue;
      if (ch === `
`) {
        const { fold, offset } = foldNewline(source, i);
        res += fold;
        i = offset;
      } else if (ch === "\\") {
        let next = source[++i];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === `
`) {
          next = source[i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "\r" && source[i + 1] === `
`) {
          next = source[++i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = next === "x" ? 2 : next === "u" ? 4 : 8;
          res += parseCharCode(source, i + 1, length, onError);
          i += length;
        } else {
          const raw = source.substr(i - 1, 2);
          onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "\t") {
        const wsStart = i;
        let next = source[i + 1];
        while (next === " " || next === "\t")
          next = source[++i + 1];
        if (next !== `
` && !(next === "\r" && source[i + 2] === `
`))
          res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "\t" || ch === `
` || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== `
`)
        break;
      if (ch === `
`)
        fold += `
`;
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  var escapeCodes = {
    "0": "\x00",
    a: "\x07",
    b: "\b",
    e: "\x1B",
    f: "\f",
    n: `
`,
    r: "\r",
    t: "\t",
    v: "\v",
    N: "",
    _: " ",
    L: "\u2028",
    P: "\u2029",
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "\t": "\t"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
      return String.fromCodePoint(code);
    } catch {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
  }
  exports.resolveFlowScalar = resolveFlowScalar;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[identity.SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[identity.SCALAR];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment)
      scalar.comment = comment;
    return scalar;
  }
  function findScalarTagByName(schema, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema[identity.SCALAR];
    const matchWithTest = [];
    for (const tag of schema.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema.knownTags[tagName];
    if (kt && !kt.collection) {
      schema.tags.push(Object.assign({}, kt, { default: false, test: undefined }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema[identity.SCALAR];
  }
  function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
    const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
    if (schema.compat) {
      const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }
  exports.composeScalar = composeScalar;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS((exports) => {
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      pos ?? (pos = before.length);
      for (let i = pos - 1;i >= 0; --i) {
        let st = before[i];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i];
        }
        break;
      }
    }
    return offset;
  }
  exports.emptyScalarPosition = emptyScalarPosition;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var composeCollection = require_compose_collection();
  var composeScalar = require_compose_scalar();
  var resolveEnd = require_resolve_end();
  var utilEmptyScalarPosition = require_util_empty_scalar_position();
  var CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar.composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        try {
          node = composeCollection.composeCollection(CN, ctx, token, props, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onError(token, "RESOURCE_EXHAUSTION", message);
        }
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        isSrcToken = false;
      }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, undefined, null, props, onError));
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar.composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias.Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }
  exports.composeEmptyNode = composeEmptyNode;
  exports.composeNode = composeNode;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS((exports) => {
  var Document = require_Document();
  var composeNode = require_compose_node();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document.Document(undefined, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps.resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }
  exports.composeDoc = composeDoc;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS((exports) => {
  var node_process = __require("process");
  var directives = require_directives();
  var Document = require_Document();
  var errors = require_errors();
  var identity = require_identity();
  var composeDoc = require_compose_doc();
  var resolveEnd = require_resolve_end();
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0;i < prelude.length; ++i) {
      const source = prelude[i];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? `

` : `
`) + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i + 1]?.[0] !== "#")
            i += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }

  class Composer {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new errors.YAMLWarning(pos, code, message));
        else
          this.errors.push(new errors.YAMLParseError(pos, code, message));
      };
      this.directives = new directives.Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (identity.isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        for (let i = 0;i < this.errors.length; ++i)
          doc.errors.push(this.errors[i]);
        for (let i = 0;i < this.warnings.length; ++i)
          doc.warnings.push(this.warnings[i]);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    *next(token) {
      if (node_process.env.LOG_STREAM)
        console.dir(token, { depth: null });
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document.Document(undefined, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  }
  exports.Composer = Composer;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS((exports) => {
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  var errors = require_errors();
  var stringifyString = require_stringifyString();
  function resolveAsScalar(token, strict = true, onError) {
    if (token) {
      const _onError = (pos, code, message) => {
        const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
        if (onError)
          onError(offset, code, message);
        else
          throw new errors.YAMLParseError([offset, offset + 1], code, message);
      };
      switch (token.type) {
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
        case "block-scalar":
          return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
      }
    }
    return null;
  }
  function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey,
      indent: indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
      { type: "newline", offset: -1, indent, source: `
` }
    ];
    switch (source[0]) {
      case "|":
      case ">": {
        const he = source.indexOf(`
`);
        const head = source.substring(0, he);
        const body = source.substring(he + 1) + `
`;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, end))
          props.push({ type: "newline", offset: -1, indent, source: `
` });
        return { type: "block-scalar", offset, indent, props, source: body };
      }
      case '"':
        return { type: "double-quoted-scalar", offset, indent, source, end };
      case "'":
        return { type: "single-quoted-scalar", offset, indent, source, end };
      default:
        return { type: "scalar", offset, indent, source, end };
    }
  }
  function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = "indent" in token ? token.indent : null;
    if (afterKey && typeof indent === "number")
      indent += 2;
    if (!type)
      switch (token.type) {
        case "single-quoted-scalar":
          type = "QUOTE_SINGLE";
          break;
        case "double-quoted-scalar":
          type = "QUOTE_DOUBLE";
          break;
        case "block-scalar": {
          const header = token.props[0];
          if (header.type !== "block-scalar-header")
            throw new Error("Invalid block scalar header");
          type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
          break;
        }
        default:
          type = "PLAIN";
      }
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey: implicitKey || indent === null,
      indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
      case "|":
      case ">":
        setBlockScalarValue(token, source);
        break;
      case '"':
        setFlowScalarValue(token, source, "double-quoted-scalar");
        break;
      case "'":
        setFlowScalarValue(token, source, "single-quoted-scalar");
        break;
      default:
        setFlowScalarValue(token, source, "scalar");
    }
  }
  function setBlockScalarValue(token, source) {
    const he = source.indexOf(`
`);
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + `
`;
    if (token.type === "block-scalar") {
      const header = token.props[0];
      if (header.type !== "block-scalar-header")
        throw new Error("Invalid block scalar header");
      header.source = head;
      token.source = body;
    } else {
      const { offset } = token;
      const indent = "indent" in token ? token.indent : -1;
      const props = [
        { type: "block-scalar-header", offset, indent, source: head }
      ];
      if (!addEndtoBlockProps(props, "end" in token ? token.end : undefined))
        props.push({ type: "newline", offset: -1, indent, source: `
` });
      for (const key of Object.keys(token))
        if (key !== "type" && key !== "offset")
          delete token[key];
      Object.assign(token, { type: "block-scalar", indent, props, source: body });
    }
  }
  function addEndtoBlockProps(props, end) {
    if (end)
      for (const st of end)
        switch (st.type) {
          case "space":
          case "comment":
            props.push(st);
            break;
          case "newline":
            props.push(st);
            return true;
        }
    return false;
  }
  function setFlowScalarValue(token, source, type) {
    switch (token.type) {
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        token.type = type;
        token.source = source;
        break;
      case "block-scalar": {
        const end = token.props.slice(1);
        let oa = source.length;
        if (token.props[0].type === "block-scalar-header")
          oa -= token.props[0].source.length;
        for (const tok of end)
          tok.offset += oa;
        delete token.props;
        Object.assign(token, { type, source, end });
        break;
      }
      case "block-map":
      case "block-seq": {
        const offset = token.offset + source.length;
        const nl = { type: "newline", offset, indent: token.indent, source: `
` };
        delete token.items;
        Object.assign(token, { type, source, end: [nl] });
        break;
      }
      default: {
        const indent = "indent" in token ? token.indent : -1;
        const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type, indent, source, end });
      }
    }
  }
  exports.createScalarToken = createScalarToken;
  exports.resolveAsScalar = resolveAsScalar;
  exports.setScalarValue = setScalarValue;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS((exports) => {
  var stringify = (cst) => ("type" in cst) ? stringifyToken(cst) : stringifyItem(cst);
  function stringifyToken(token) {
    switch (token.type) {
      case "block-scalar": {
        let res = "";
        for (const tok of token.props)
          res += stringifyToken(tok);
        return res + token.source;
      }
      case "block-map":
      case "block-seq": {
        let res = "";
        for (const item of token.items)
          res += stringifyItem(item);
        return res;
      }
      case "flow-collection": {
        let res = token.start.source;
        for (const item of token.items)
          res += stringifyItem(item);
        for (const st of token.end)
          res += st.source;
        return res;
      }
      case "document": {
        let res = stringifyItem(token);
        if (token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
      default: {
        let res = token.source;
        if ("end" in token && token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
    }
  }
  function stringifyItem({ start, key, sep, value }) {
    let res = "";
    for (const st of start)
      res += st.source;
    if (key)
      res += stringifyToken(key);
    if (sep)
      for (const st of sep)
        res += st.source;
    if (value)
      res += stringifyToken(value);
    return res;
  }
  exports.stringify = stringify;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS((exports) => {
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove item");
  function visit(cst, visitor) {
    if ("type" in cst && cst.type === "document")
      cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  visit.itemAtPath = (cst, path19) => {
    let item = cst;
    for (const [field, index] of path19) {
      const tok = item?.[field];
      if (tok && "items" in tok) {
        item = tok.items[index];
      } else
        return;
    }
    return item;
  };
  visit.parentCollection = (cst, path19) => {
    const parent = visit.itemAtPath(cst, path19.slice(0, -1));
    const field = path19[path19.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path19, item, visitor) {
    let ctrl = visitor(item, path19);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item[field];
      if (token && "items" in token) {
        for (let i = 0;i < token.items.length; ++i) {
          const ci = _visit(Object.freeze(path19.concat([[field, i]])), token.items[i], visitor);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            token.items.splice(i, 1);
            i -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item, path19);
      }
    }
    return typeof ctrl === "function" ? ctrl(item, path19) : ctrl;
  }
  exports.visit = visit;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS((exports) => {
  var cstScalar = require_cst_scalar();
  var cstStringify = require_cst_stringify();
  var cstVisit = require_cst_visit();
  var BOM = "\uFEFF";
  var DOCUMENT = "\x02";
  var FLOW_END = "\x18";
  var SCALAR = "\x1F";
  var isCollection = (token) => !!token && ("items" in token);
  var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
  function prettyToken(token) {
    switch (token) {
      case BOM:
        return "<BOM>";
      case DOCUMENT:
        return "<DOC>";
      case FLOW_END:
        return "<FLOW_END>";
      case SCALAR:
        return "<SCALAR>";
      default:
        return JSON.stringify(token);
    }
  }
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case `
`:
      case `\r
`:
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "\t":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }
  exports.createScalarToken = cstScalar.createScalarToken;
  exports.resolveAsScalar = cstScalar.resolveAsScalar;
  exports.setScalarValue = cstScalar.setScalarValue;
  exports.stringify = cstStringify.stringify;
  exports.visit = cstVisit.visit;
  exports.BOM = BOM;
  exports.DOCUMENT = DOCUMENT;
  exports.FLOW_END = FLOW_END;
  exports.SCALAR = SCALAR;
  exports.isCollection = isCollection;
  exports.isScalar = isScalar;
  exports.prettyToken = prettyToken;
  exports.tokenType = tokenType;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS((exports) => {
  var cst = require_cst();
  function isEmpty(ch) {
    switch (ch) {
      case undefined:
      case " ":
      case `
`:
      case "\r":
      case "\t":
        return true;
      default:
        return false;
    }
  }
  var hexDigits = new Set("0123456789ABCDEFabcdef");
  var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  var flowIndicatorChars = new Set(",[]{}");
  var invalidAnchorChars = new Set(` ,[]{}
\r	`);
  var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);

  class Lexer {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i = this.pos;
      let ch = this.buffer[i];
      while (ch === " " || ch === "\t")
        ch = this.buffer[++i];
      if (!ch || ch === "#" || ch === `
`)
        return true;
      if (ch === "\r")
        return this.buffer[i + 1] === `
`;
      return false;
    }
    charAt(n) {
      return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === `
` || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === `
` || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf(`
`, this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
      return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n) {
      return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === cst.BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "\t") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "\t")
            dirEnd -= 1;
          else
            break;
        }
        const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield cst.DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n;
        return "block-start";
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n = yield* this.pushIndicators();
      switch (line[n]) {
        case "#":
          yield* this.pushCount(line.length - n);
        case undefined:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n += yield* this.parseBlockScalarHeader();
          n += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield cst.FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n = 0;
      while (line[n] === ",") {
        n += yield* this.pushCount(1);
        n += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n += yield* this.pushIndicators();
      switch (line[n]) {
        case undefined:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n = 0;
          while (this.buffer[end - 1 - n] === "\\")
            n += 1;
          if (n % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf(`
`, this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf(`
`, cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i = this.pos;
      while (true) {
        const ch = this.buffer[++i];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop:
        for (let i2 = this.pos;ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case `
`:
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === `
`)
                break;
            }
            default:
              break loop;
          }
        }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf(`
`, cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i = nl + 1;
      ch = this.buffer[i];
      while (ch === " ")
        ch = this.buffer[++i];
      if (ch === "\t") {
        while (ch === "\t" || ch === " " || ch === "\r" || ch === `
`)
          ch = this.buffer[++i];
        nl = i - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i2 = nl - 1;
          let ch2 = this.buffer[i2];
          if (ch2 === "\r")
            ch2 = this.buffer[--i2];
          const lastChar = i2;
          while (ch2 === " ")
            ch2 = this.buffer[--i2];
          if (ch2 === `
` && i2 >= this.pos && i2 + 1 + indent > lastChar)
            nl = i2;
          else
            break;
        } while (true);
      }
      yield cst.SCALAR;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i]) {
        if (ch === ":") {
          const next = this.buffer[i + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i + 1];
          if (ch === "\r") {
            if (next === `
`) {
              i += 1;
              ch = `
`;
              next = this.buffer[i + 1];
            } else
              end = i;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === `
`) {
            const cs = this.continueScalar(i + 1);
            if (cs === -1)
              break;
            i = Math.max(i, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield cst.SCALAR;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n) {
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos += n;
        return n;
      }
      return 0;
    }
    *pushToIndex(i, allowEmpty) {
      const s = this.buffer.slice(this.pos, i);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      let n = 0;
      loop:
        while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            case "?":
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
      return n;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i = this.pos + 2;
        let ch = this.buffer[i];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i];
        return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
      } else {
        let i = this.pos + 1;
        let ch = this.buffer[i];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i];
          else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
            ch = this.buffer[i += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === `
`)
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === `
`)
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i];
      } while (ch === " " || allowTabs && ch === "\t");
      const n = i - this.pos;
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos = i;
      }
      return n;
    }
    *pushUntil(test) {
      let i = this.pos;
      let ch = this.buffer[i];
      while (!test(ch))
        ch = this.buffer[++i];
      return yield* this.pushToIndex(i, false);
    }
  }
  exports.Lexer = Lexer;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS((exports) => {
  class LineCounter {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  }
  exports.LineCounter = LineCounter;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS((exports) => {
  var node_process = __require("process");
  var cst = require_cst();
  var lexer = require_lexer();
  function includesToken(list, type) {
    for (let i = 0;i < list.length; ++i)
      if (list[i].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list) {
    for (let i = 0;i < list.length; ++i) {
      switch (list[i].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i = prev.length;
    loop:
      while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
    while (prev[++i]?.type === "space") {}
    return prev.splice(i, prev.length);
  }
  function arrayPushArray(target, source) {
    if (source.length < 1e5)
      Array.prototype.push.apply(target, source);
    else
      for (let i = 0;i < source.length; ++i)
        target.push(source[i]);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              arrayPushArray(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            arrayPushArray(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }

  class Parser {
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new lexer.Lexer;
      this.onNewLine = onNewLine;
    }
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    *next(source) {
      this.source = source;
      if (node_process.env.LOG_TOKENS)
        console.log("|", cst.prettyToken(source));
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = cst.tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && top?.type !== "doc-end") {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n) {
      return this.stack[this.stack.length - n];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf(`
`) + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf(`
`, nl) + 1;
            }
          }
          yield* this.pop();
          break;
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map) {
      const it = map.items[map.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map.indent)) {
              const prev = map.items[map.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                map.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i = 0;i < it.sep.length; ++i) {
            const st = it.sep[i];
            switch (st.type) {
              case "newline":
                nl.push(i);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs15 = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map.items.push({ start, key: fs15, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs15);
            } else {
              Object.assign(it, { key: fs15, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map);
            if (bv) {
              if (bv.type === "block-seq") {
                if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                  yield* this.pop({
                    type: "error",
                    offset: this.offset,
                    message: "Unexpected block-seq-ind on same line with key",
                    source: this.source
                  });
                  return;
                }
              } else if (atMapIndent) {
                map.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq) {
      const it = seq.items[seq.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq.indent)) {
              const prev = seq.items[seq.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                seq.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq.indent) {
        const bv = this.startBlockValue(seq);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top?.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs15 = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs15, sep: [] });
            else if (it.sep)
              this.stack.push(fs15);
            else
              Object.assign(it, { key: fs15, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf(`
`) + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf(`
`, nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  }
  exports.Parser = Parser;
});

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS((exports) => {
  var composer = require_composer();
  var Document = require_Document();
  var errors = require_errors();
  var log = require_log();
  var identity = require_identity();
  var lineCounter = require_line_counter();
  var parser = require_parser();
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter || null;
    return { lineCounter: lineCounter$1, prettyErrors };
  }
  function parseAllDocuments(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter2)
      for (const doc of docs) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
    if (docs.length > 0)
      return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
  }
  function parseDocument(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter2) {
      doc.errors.forEach(errors.prettifyError(source, lineCounter2));
      doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
    }
    return doc;
  }
  function parse(src, reviver, options) {
    let _reviver = undefined;
    if (typeof reviver === "function") {
      _reviver = reviver;
    } else if (options === undefined && reviver && typeof reviver === "object") {
      options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
      return null;
    doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
      if (doc.options.logLevel !== "silent")
        throw doc.errors[0];
      else
        doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
  }
  function stringify(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === undefined && replacer) {
      options = replacer;
    }
    if (typeof options === "string")
      options = options.length;
    if (typeof options === "number") {
      const indent = Math.round(options);
      options = indent < 1 ? undefined : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === undefined) {
      const { keepUndefined } = options ?? replacer ?? {};
      if (!keepUndefined)
        return;
    }
    if (identity.isDocument(value) && !_replacer)
      return value.toString(options);
    return new Document.Document(value, _replacer, options).toString(options);
  }
  exports.parse = parse;
  exports.parseAllDocuments = parseAllDocuments;
  exports.parseDocument = parseDocument;
  exports.stringify = stringify;
});

// plugins/foundry/src/mcp/server.ts
import readline from "node:readline";
import { readFileSync } from "node:fs";
import { fileURLToPath as fileURLToPath4 } from "node:url";
import path23 from "node:path";

// plugins/foundry/src/core/storage.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
var runtimeDir = path.dirname(fileURLToPath(import.meta.url));
var runtimePluginRoot = path.basename(runtimeDir) === "dist" ? path.resolve(runtimeDir, "..") : path.resolve(runtimeDir, "..", "..");
var lowerRuntimePluginRoot = runtimePluginRoot.toLowerCase();
var isCodeBuddyInstall = lowerRuntimePluginRoot.includes(path.join(".codebuddy", "plugins", "marketplaces").toLowerCase());
var isCodexInstall = lowerRuntimePluginRoot.includes(path.join(".codex", "plugins", "cache").toLowerCase());
var anchorHome = process.env.CODEBUDDY_PLUGIN_DATA ? path.resolve(process.env.CODEBUDDY_PLUGIN_DATA, ".usora") : process.env.PLUGIN_DATA ? path.resolve(process.env.PLUGIN_DATA, ".usora") : process.env.CODEBUDDY_PLUGIN_ROOT || isCodeBuddyInstall ? path.join(os.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora") : process.env.CLAUDE_PLUGIN_ROOT || isCodexInstall ? path.join(os.homedir(), ".codex", "plugins", "data", "usora", ".usora") : path.resolve(process.cwd(), ".usora");
var hostHomeSource = process.env.CODEBUDDY_PLUGIN_DATA || process.env.PLUGIN_DATA ? "host_plugin_data" : process.env.CODEBUDDY_PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || isCodeBuddyInstall || isCodexInstall ? "host_plugin_data" : "development";
var knowledgeHome = process.env.USORA_HOME ? path.resolve(process.env.USORA_HOME) : hostHomeSource === "development" ? anchorHome : path.join(os.homedir(), ".usora");
var _knowledgeHomeSource = process.env.USORA_HOME ? "environment" : hostHomeSource === "development" ? "development" : "default";
var processSessionId = `session-${Date.now().toString(16).padStart(12, "0")}-${crypto.randomBytes(16).toString("hex")}`;
var HUB_SCHEMA_VERSION = 2;
var ACTIVITY_SCHEMA_VERSION = 2;
var CANDIDATE_SCHEMA_VERSION = 2;
var PATTERN_SCHEMA_VERSION = 1;
var SKILL_METADATA_SCHEMA_VERSION = 2;
var EVENT_SCHEMA_VERSION = 1;
var DIRS = [
  "activities",
  "candidates",
  "skills",
  "usage",
  "archive",
  "events",
  "sessions",
  "indexes",
  "backups"
];
var HOST_DIRS = ["activities", "sessions", "runtime", "archive"];
var KNOWLEDGE_DIRS = ["candidates", "skills", "usage", "archive", "events", "indexes", "backups"];
var AUTOMATION_POLICIES = ["auto_publish", "manual_approval", "auto_generate_manual_publish"];
var ARCHIVABLE_STATES = ["ABSORBED"];
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
var now = () => new Date().toISOString();
var newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
async function resolveHome(config) {
  const cfg = config || await loadConfig();
  return typeof cfg.hub_path === "string" && cfg.hub_path ? path.resolve(cfg.hub_path) : anchorHome;
}
async function resolveHostHome(config) {
  return resolveHome(config);
}
async function resolveKnowledgeHome() {
  return knowledgeHome;
}
async function hostDirPath(dir) {
  return path.join(await resolveHostHome(), dir);
}
async function knowledgeDirPath(dir) {
  return path.join(await resolveKnowledgeHome(), dir);
}
async function ensure() {
  const host = await resolveHostHome();
  const knowledge = await resolveKnowledgeHome();
  await Promise.all([
    ...HOST_DIRS.map((dir) => fs.mkdir(path.join(host, dir), { recursive: true })),
    ...KNOWLEDGE_DIRS.map((dir) => fs.mkdir(path.join(knowledge, dir), { recursive: true }))
  ]);
}
async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}
async function copyHubData(sourceHome, targetHome) {
  if (path.resolve(sourceHome) === path.resolve(targetHome))
    return;
  for (const dir of DIRS) {
    const src = path.join(sourceHome, dir);
    if (!await exists(src))
      continue;
    await fs.mkdir(path.join(targetHome, dir), { recursive: true });
    await fs.cp(src, path.join(targetHome, dir), { recursive: true, force: false, errorOnExist: false });
  }
}
async function migrateLegacyConfig() {
  const currentConfig = path.join(anchorHome, "config.json");
  if (await exists(currentConfig))
    return null;
  const legacyHomes = [path.join(runtimePluginRoot, ".usora"), path.resolve(process.cwd(), ".usora")];
  for (const legacyHome of legacyHomes) {
    const config = await readJson(path.join(legacyHome, "config.json"));
    if (!isObject(config))
      continue;
    const legacyHub = typeof config.hub_path === "string" && config.hub_path ? path.resolve(config.hub_path) : legacyHome;
    if (legacyHome !== path.join(runtimePluginRoot, ".usora") && !isInside(runtimePluginRoot, legacyHub))
      continue;
    await copyHubData(legacyHub, anchorHome);
    const next = { ...config };
    if (isInside(runtimePluginRoot, legacyHub)) {
      delete next.hub_path;
    }
    await saveConfig(next);
    return normalizeConfig(next);
  }
  return null;
}
async function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}
`, "utf8");
  await fs.rename(tmp, file);
}
async function writeEvent(type, data) {
  const file = path.join(await knowledgeDirPath("events"), `${Date.now()}-${newId("event")}.json`);
  await writeJson(file, { schema_version: EVENT_SCHEMA_VERSION, type, timestamp: now(), data });
}
function normalizeConfig(value) {
  return {
    maintainer: typeof value.maintainer === "string" ? value.maintainer : "codex",
    automation_policy: typeof value.automation_policy === "string" ? value.automation_policy : "manual_approval",
    ...value,
    version: typeof value.version === "number" ? value.version : HUB_SCHEMA_VERSION,
    hub_schema_version: typeof value.hub_schema_version === "number" ? value.hub_schema_version : typeof value.version === "number" ? value.version : HUB_SCHEMA_VERSION,
    intelligence: {
      candidate_min_occurrences: 2,
      ...isObject(value.intelligence) ? value.intelligence : {}
    }
  };
}
async function loadConfig() {
  const migrated = await migrateLegacyConfig();
  if (migrated)
    return migrated;
  const config = await readJson(path.join(anchorHome, "config.json"), {
    maintainer: "codex",
    automation_policy: "manual_approval",
    version: HUB_SCHEMA_VERSION,
    hub_schema_version: HUB_SCHEMA_VERSION,
    intelligence: { candidate_min_occurrences: 2 }
  });
  return normalizeConfig(config || {});
}
async function saveConfig(value) {
  const next = normalizeConfig(value);
  await fs.mkdir(anchorHome, { recursive: true });
  await writeJson(path.join(anchorHome, "config.json"), next);
  return next;
}

// plugins/foundry/src/core/activities.ts
import fs2 from "node:fs/promises";
import path3 from "node:path";

// plugins/foundry/src/core/intelligence/digest.ts
var LIMITS = {
  task: 200,
  result: 300,
  keyPoint: 160,
  keyPoints: 5,
  technologies: 10
};
function compact(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}
function buildActivityDigest(activity) {
  const technologies = Array.isArray(activity.technologies) ? activity.technologies : [];
  const keyPoints = Array.isArray(activity.key_points) ? activity.key_points : [];
  return {
    schema_version: 1,
    id: activity.id,
    project: activity.project || null,
    source: activity.source || null,
    type: activity.type || activity.metadata?.type || null,
    high_value: Boolean(activity.high_value || activity.metadata?.high_value),
    domain: activity.domain || activity.metadata?.domain || null,
    topic: activity.topic || activity.metadata?.topic || null,
    task: compact(activity.task, LIMITS.task),
    result: compact(activity.result, LIMITS.result),
    technologies: technologies.slice(0, LIMITS.technologies),
    key_points: keyPoints.slice(0, LIMITS.keyPoints).map((point) => compact(point, LIMITS.keyPoint)),
    fingerprint: activity.fingerprint || null,
    fingerprint_version: activity.fingerprint_version || null,
    occurrences: activity.occurrences || 1,
    updated_at: activity.updated_at,
    state: activity.state
  };
}

// plugins/foundry/src/core/intelligence/fingerprint.ts
import crypto2 from "node:crypto";
var FINGERPRINT_VERSION = 1;
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[\\/][\w.-]+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean).slice(0, 24).sort().join(" ");
}
function normalizeList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeText).filter(Boolean))].sort().join(",");
}
function buildActivityFingerprint(activity) {
  const input = [
    activity.project || "",
    normalizeText(activity.domain || ""),
    normalizeText(activity.topic || ""),
    normalizeList(activity.technologies),
    normalizeText(activity.task || "")
  ].join("|");
  return {
    version: FINGERPRINT_VERSION,
    value: `sha256:${crypto2.createHash("sha256").update(input).digest("hex")}`
  };
}

// plugins/foundry/src/core/validation.ts
import path2 from "node:path";
function requireString(value, field) {
  if (typeof value !== "string") {
    throw Error(`${field} is required`);
  }
  return value;
}
function safeName(value, field) {
  const name = requireString(value, field);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(name)) {
    throw Error(`${field} must contain only letters, numbers, and hyphens`);
  }
  return name;
}
function isInside2(parent, child) {
  const rel = path2.relative(parent, child);
  return Boolean(rel) && !rel.startsWith("..") && !path2.isAbsolute(rel);
}
function mergeUnique(left, right) {
  return [...new Set([...left || [], ...right || []])];
}
function listLimit(value) {
  return Math.min(Math.max(Number(value) || 20, 1), 100);
}

// plugins/foundry/src/core/activities.ts
var RECENT_UPDATE_LIMIT = 10;
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function findActivityBySession(sessionId) {
  const dir = await hostDirPath("activities");
  for (const file of await fs2.readdir(dir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path3.join(dir, file));
    if (!isRecord(item))
      continue;
    if (item?.session_id === sessionId)
      return { file, item };
  }
  return null;
}
async function readActivities() {
  const activitiesDir = await hostDirPath("activities");
  const items = [];
  for (const file of await fs2.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path3.join(activitiesDir, file));
    if (isRecord(item))
      items.push(item);
  }
  return items;
}
function pickFields(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
function normalizeActivityHistory(item) {
  item.recent_updates = item.recent_updates || item.updates || [];
  item.history = item.history || {
    update_count: item.recent_updates.length,
    first_seen: item.started_at || item.recent_updates[0]?.timestamp || null,
    last_seen: item.updated_at || item.recent_updates.at(-1)?.timestamp || null,
    key_points: item.key_points || [],
    segments: []
  };
  delete item.updates;
}
function pushActivityUpdate(item, update) {
  item.recent_updates ||= [];
  item.history ||= { update_count: 0, key_points: [], segments: [] };
  item.recent_updates.push(update);
  item.history.update_count = (item.history.update_count || 0) + 1;
  item.history.first_seen = item.history.first_seen || update.timestamp;
  item.history.last_seen = update.timestamp;
  item.history.key_points = mergeUnique(item.history.key_points, update.key_points);
  if (item.recent_updates.length > RECENT_UPDATE_LIMIT) {
    item.recent_updates = item.recent_updates.slice(-RECENT_UPDATE_LIMIT);
  }
}
function updateHistorySourceRef(item) {
  item.history ||= { update_count: 0, key_points: [], segments: [] };
  if (item.history.source_ref || !item.metadata?.transcript_path)
    return;
  item.history.source_ref = { type: "host_transcript", path: item.metadata.transcript_path };
}
async function captureActivity(args, options = {}) {
  if (options.requireTaskResult !== false && (!args.task || !args.result)) {
    throw Error("task and result are required");
  }
  await ensure();
  const sessionId = args.session_id || processSessionId;
  const existing = await findActivityBySession(sessionId);
  const timestamp = args.timestamp || now();
  const item = existing?.item || {
    schema_version: ACTIVITY_SCHEMA_VERSION,
    id: newId("activity"),
    source: args.source || "codex",
    session_id: sessionId,
    session_id_source: args.session_id ? "provided" : "mcp_process",
    project: args.project || null,
    started_at: timestamp,
    state: "NEW",
    task: null,
    result: null,
    key_points: [],
    recent_updates: [],
    history: {
      update_count: 0,
      first_seen: timestamp,
      last_seen: timestamp,
      key_points: [],
      segments: []
    }
  };
  item.schema_version = item.schema_version || ACTIVITY_SCHEMA_VERSION;
  normalizeActivityHistory(item);
  item.source = args.source || item.source;
  item.project = args.project || item.project;
  item.task = args.task ?? item.task;
  item.context = args.context || item.context || "";
  item.result = args.result ?? item.result;
  item.outcome = args.outcome || item.outcome || "success";
  item.approach = mergeUnique(item.approach, args.approach);
  item.technologies = mergeUnique(item.technologies, args.technologies);
  item.key_points = mergeUnique(item.key_points, args.key_points);
  item.metadata = { ...item.metadata, ...args.metadata };
  updateHistorySourceRef(item);
  pushActivityUpdate(item, {
    timestamp,
    summary: args.summary || args.result || "Session captured",
    key_points: args.key_points || []
  });
  item.updated_at = timestamp;
  const fingerprint = buildActivityFingerprint(item);
  item.fingerprint_version = fingerprint.version;
  item.fingerprint = fingerprint.value;
  item.digest = buildActivityDigest(item);
  const file = existing?.file || `${item.id}.json`;
  await writeJson(path3.join(await hostDirPath("activities"), file), item);
  await writeEvent(existing ? "ActivityUpdated" : "ActivityCreated", item);
  return { ...item, merged: Boolean(existing) };
}
async function handleActivityCapture(args) {
  return captureActivity(args);
}
async function handleActivityList(args = {}) {
  const limit = listLimit(args.limit);
  const items = await readActivities();
  items.sort((a, b) => (b.updated_at || b.started_at || "").localeCompare(a.updated_at || a.started_at || ""));
  return { count: items.length, activities: items.slice(0, limit) };
}
async function handleActivityDigestList(args = {}) {
  const list = await handleActivityList(args);
  return {
    count: list.count,
    activities: list.activities.map((activity) => activity.digest || buildActivityDigest(activity))
  };
}
async function handleActivityQuery(args = {}) {
  const limit = listLimit(args.limit);
  let activities = await readActivities();
  if (args.state)
    activities = activities.filter((activity) => activity.state === args.state);
  if (args.since) {
    const since = args.since;
    activities = activities.filter((activity) => (activity.updated_at || activity.started_at || "") >= since);
  }
  activities.sort((a, b) => (b.updated_at || b.started_at || "").localeCompare(a.updated_at || a.started_at || ""));
  const projection = args.projection || "digest";
  return {
    count: activities.length,
    activities: activities.slice(0, limit).map((activity) => {
      if (args.fields)
        return pickFields(activity, args.fields);
      return projection === "full" ? activity : activity.digest || buildActivityDigest(activity);
    })
  };
}
async function handleActivityGet(args = {}) {
  const id = safeName(args.id, "id");
  const activity = await readJson(path3.join(await hostDirPath("activities"), `${id}.json`));
  if (!isRecord(activity))
    throw Error("Activity not found");
  return pickFields(activity, args.fields);
}

// plugins/foundry/src/core/candidates.ts
import fs7 from "node:fs/promises";
import path10 from "node:path";

// plugins/foundry/src/core/context-budget.ts
import fs3 from "node:fs/promises";
import path4 from "node:path";
var STAGE_BUDGETS = {
  pattern_judge: { required: 1200, recommended: 1200, optional: 600 },
  candidate_resolver: { required: 1600, recommended: 1600, optional: 800 },
  skill_compiler: { required: 2400, recommended: 1800, optional: 1200 },
  evaluator: { required: 1000, recommended: 800, optional: 400 }
};
var BUDGET_PARTS = ["required", "recommended", "optional"];
function jsonChars(value) {
  return JSON.stringify(value ?? null).length;
}
function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}
function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}
function numberValue(value) {
  return typeof value === "number" ? value : 0;
}
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function partReport(stage, parts = {}) {
  const budget = STAGE_BUDGETS[stage] || STAGE_BUDGETS.candidate_resolver;
  const entries = Object.fromEntries(BUDGET_PARTS.map((kind) => {
    const chars = jsonChars(parts[kind] || {});
    return [kind, { chars, budget_chars: budget[kind], overflow: chars > budget[kind] }];
  }));
  const total_chars = entries.required.chars + entries.recommended.chars + entries.optional.chars;
  const budget_chars = budget.required + budget.recommended + budget.optional;
  return {
    stage,
    ...entries,
    total_chars,
    budget_chars,
    estimated_tokens: estimateTokens(total_chars),
    overflow: total_chars > budget_chars || Object.values(entries).some((entry) => entry.overflow)
  };
}
async function checkContextBudget(stage, parts = {}) {
  const report = partReport(stage, parts);
  if (report.overflow)
    await writeEvent("ContextBudgetOverflow", report);
  return report;
}
async function recordIntelligenceRun(args = {}) {
  const input_chars = args.input_chars ?? jsonChars(args.input);
  const output_chars = args.output_chars ?? jsonChars(args.output);
  const event = {
    stage: args.stage || "unknown",
    started_at: args.started_at || now(),
    duration_ms: Number(args.duration_ms) || 0,
    input_chars,
    output_chars,
    estimated_input_tokens: estimateTokens(input_chars),
    estimated_output_tokens: estimateTokens(output_chars),
    evidence_loaded: Number(args.evidence_loaded) || 0,
    skills_loaded: Number(args.skills_loaded) || 0,
    full_activity_load: Boolean(args.full_activity_load),
    full_skill_load: Boolean(args.full_skill_load),
    cache_hit: Boolean(args.cache_hit),
    budget: args.budget || null
  };
  await writeEvent("IntelligenceRun", event);
  return event;
}
async function handleContextBudget(args = {}) {
  return checkContextBudget(args.stage || "candidate_resolver", {
    required: args.required || {},
    recommended: args.recommended || {},
    optional: args.optional || {}
  });
}
async function readEvents() {
  const eventsDir = await knowledgeDirPath("events");
  const items = [];
  for (const file of await fs3.readdir(eventsDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path4.join(eventsDir, file));
    if (isRecord2(item))
      items.push(item);
  }
  return items;
}
async function handleTelemetryMetrics() {
  const events = await readEvents();
  const runs = events.filter((event) => event.type === "IntelligenceRun").map((event) => event.data || {});
  const resolved = events.filter((event) => event.type === "CandidateResolved").map((event) => event.data || {});
  const rawPatternIndex = await readJson(path4.join(await knowledgeDirPath("indexes"), "patterns.json")).catch(() => null);
  const patternIndex = isRecord2(rawPatternIndex) ? rawPatternIndex : {};
  const patterns = Array.isArray(patternIndex.patterns) ? patternIndex.patterns : [];
  return {
    runs: runs.length,
    candidate_merge_rate: resolved.length ? resolved.filter((event) => event.action === "matched" || event.merge_target).length / resolved.length : 0,
    candidate_drop_rate: resolved.length ? resolved.filter((event) => event.action === "dropped").length / resolved.length : 0,
    activity_full_load_avoided: runs.filter((run) => run.full_activity_load === false).length,
    skill_full_load_avoided: runs.filter((run) => run.full_skill_load === false).length,
    avg_context_chars: average(runs.map((run) => numberValue(run.input_chars))),
    avg_evidence_loaded: average(runs.map((run) => numberValue(run.evidence_loaded))),
    pattern_reuse_rate: patterns.length ? patterns.filter((pattern) => pattern.candidate_id).length / patterns.length : 0,
    note: "Token counts are chars/4 estimates only; no absolute token savings are claimed."
  };
}

// plugins/foundry/src/core/lock.ts
import fs4 from "node:fs/promises";
import path5 from "node:path";
var STALE_LOCK_MS = 30000;
var heldLocks = new Set;
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function withKnowledgeLock(name, fn) {
  if (heldLocks.has(name))
    return fn();
  const locksDir = path5.join(await knowledgeDirPath("indexes"), "locks");
  await fs4.mkdir(locksDir, { recursive: true });
  const file = path5.join(locksDir, `${name}.lock`);
  for (let attempt = 0;attempt < 100; attempt++) {
    let handle = null;
    try {
      handle = await fs4.open(file, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
      await handle.close();
      heldLocks.add(name);
      try {
        return await fn();
      } finally {
        heldLocks.delete(name);
        await fs4.rm(file, { force: true });
      }
    } catch (err) {
      await handle?.close().catch(() => {});
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      if (code !== "EEXIST")
        throw err;
      const stat = await fs4.stat(file).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        await fs4.rm(file, { force: true }).catch(() => {});
      }
      await sleep(25);
    }
  }
  throw Error(`Timed out waiting for ${name} knowledge lock`);
}

// plugins/foundry/src/core/patterns.ts
import fs6 from "node:fs/promises";
import path9 from "node:path";

// plugins/foundry/src/core/intelligence/activity-content.ts
function hasActivityContent(activity) {
  const meaningful = (value) => typeof value === "string" && value.trim().length > 0;
  const digest = activity.digest && typeof activity.digest === "object" && !Array.isArray(activity.digest) ? activity.digest : {};
  return meaningful(activity.task) || meaningful(activity.result) || Array.isArray(activity.key_points) && activity.key_points.some(meaningful) || meaningful(digest.task) || meaningful(digest.result) || meaningful(digest.topic) || meaningful(digest.domain) || meaningful(digest.type) || Array.isArray(digest.technologies) && digest.technologies.some(meaningful) || Array.isArray(digest.key_points) && digest.key_points.some(meaningful);
}

// plugins/foundry/src/sources/registry.ts
import os2 from "node:os";
import path7 from "node:path";

// plugins/foundry/src/sources/local-activity-source.ts
import fs5 from "node:fs/promises";
import path6 from "node:path";
function isRecord3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function exists2(dir) {
  try {
    await fs5.access(dir);
    return true;
  } catch {
    return false;
  }
}

class LocalActivitySource {
  id;
  host;
  rootResolver;
  constructor(id, host, rootResolver) {
    this.id = id;
    this.host = host;
    this.rootResolver = rootResolver;
  }
  async root() {
    return this.rootResolver();
  }
  async activitiesPath() {
    const root = await this.root();
    return root ? path6.join(root, "activities") : null;
  }
  async discover() {
    const dir = await this.activitiesPath();
    return Boolean(dir && await exists2(dir));
  }
  async readActivities() {
    const dir = await this.activitiesPath();
    if (!dir)
      return [];
    const records = [];
    for (const file of await fs5.readdir(dir).catch(() => [])) {
      if (!file.endsWith(".json"))
        continue;
      const activity = await readJson(path6.join(dir, file));
      if (!isRecord3(activity) || !activity.fingerprint || !isRecord3(activity.digest))
        continue;
      if (activity.state === "ARCHIVED")
        continue;
      records.push({ source: { id: this.id, host: this.host }, activity });
    }
    return records;
  }
}
async function currentHostRoot() {
  return path6.dirname(await hostDirPath("activities"));
}

// plugins/foundry/src/sources/registry.ts
function envPath(name) {
  return process.env[name] ? path7.resolve(process.env[name]) : null;
}
function codebuddyRoot() {
  return path7.join(os2.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora");
}
function codexRoot() {
  return path7.join(os2.homedir(), ".codex", "plugins", "data", "usora", ".usora");
}
function currentHost() {
  return process.env.CODEBUDDY_PLUGIN_DATA || process.env.CODEBUDDY_PLUGIN_ROOT ? "codebuddy" : "codex";
}
function activitySources() {
  const host = currentHost();
  return [
    new LocalActivitySource(host, host, async () => envPath(host === "codebuddy" ? "USORA_CODEBUDDY_HOME" : "USORA_CODEX_HOME") || await currentHostRoot()),
    new LocalActivitySource("codebuddy", "codebuddy", async () => envPath("USORA_CODEBUDDY_HOME") || codebuddyRoot()),
    new LocalActivitySource("codex-home", "codex", async () => envPath("USORA_CODEX_HOME") || codexRoot())
  ];
}
async function discoverActivitySources() {
  const seen = new Set;
  const available = [];
  for (const source of activitySources()) {
    const root = await source.root();
    if (!root)
      continue;
    const key = path7.resolve(root).toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    if (await source.discover())
      available.push(source);
  }
  return available;
}
async function describeActivitySources() {
  const seen = new Set;
  const result = [];
  for (const source of activitySources()) {
    const root = await source.root();
    const key = root ? path7.resolve(root).toLowerCase() : `${source.id}:missing`;
    if (seen.has(key))
      continue;
    seen.add(key);
    result.push({
      id: source.id,
      host: source.host,
      available: await source.discover(),
      root,
      activities: await source.activitiesPath()
    });
  }
  return result;
}

// plugins/foundry/src/sources/ingestion-state.ts
import path8 from "node:path";
async function ingestionStatePath() {
  return path8.join(await knowledgeDirPath("indexes"), "ingestion.json");
}
async function loadIngestionState() {
  const state = await readJson(await ingestionStatePath());
  return state && typeof state === "object" && !Array.isArray(state) && state.sources ? state : { schema_version: 1, sources: {} };
}
async function saveIngestionState(state) {
  await writeJson(await ingestionStatePath(), state);
}

// plugins/foundry/src/core/patterns.ts
var PATTERNS_FILE = "patterns.json";
function isRecord4(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function asPatternIndex(value) {
  if (!isRecord4(value) || !Array.isArray(value.patterns)) {
    return { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] };
  }
  return { schema_version: PATTERN_SCHEMA_VERSION, patterns: value.patterns.filter(isRecord4) };
}
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
async function patternsPath() {
  return path9.join(await knowledgeDirPath("indexes"), PATTERNS_FILE);
}
async function readPatterns() {
  return asPatternIndex(await readJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] }));
}
async function writePatterns(index) {
  await writeJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: index.patterns || [] });
}
async function linkPatternCandidate(fingerprint, candidateId) {
  if (!fingerprint || !candidateId)
    return null;
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === fingerprint);
  if (!pattern)
    return null;
  pattern.candidate_id = candidateId;
  pattern.state = "CANDIDATE";
  await writePatterns(index);
  return pattern;
}
async function readLegacyActivities({ includeIndexed = false } = {}) {
  const activitiesDir = path9.join(path9.dirname(await knowledgeDirPath("indexes")), "activities");
  const items = [];
  for (const file of await fs6.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path9.join(activitiesDir, file));
    if (!isRecord4(item) || !item.fingerprint || !isRecord4(item.digest))
      continue;
    if (!includeIndexed && item.state !== "NEW")
      continue;
    if (item.state === "ARCHIVED")
      continue;
    items.push({ source: { id: "local", host: "local" }, activity: item });
  }
  return items;
}
async function readActivities2({ includeIndexed = false } = {}) {
  const sources = await discoverActivitySources();
  if (sources.length === 0)
    return readLegacyActivities({ includeIndexed });
  const records = (await Promise.all(sources.map((source) => source.readActivities()))).flat();
  return includeIndexed ? records : records.filter(({ activity }) => activity.state === "NEW");
}
function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}
function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}
function pickFields2(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
function patternFromActivity(activity) {
  const digest = isRecord4(activity.digest) ? activity.digest : {};
  return {
    schema_version: PATTERN_SCHEMA_VERSION,
    fingerprint: activity.fingerprint,
    fingerprint_version: activity.fingerprint_version,
    domain: digest.domain || activity.domain || null,
    topic: digest.topic || activity.topic || null,
    type: stringOrNull(digest.type || activity.type || activity.metadata?.type),
    high_value: Boolean(digest.high_value || activity.high_value || activity.metadata?.high_value),
    technologies: arrayValue(digest.technologies || activity.technologies),
    activity_ids: [],
    occurrences: 0,
    project_ids: [],
    projects: 0,
    first_seen: activity.started_at || activity.updated_at || null,
    last_seen: activity.updated_at || activity.started_at || null,
    candidate_id: null,
    state: "OBSERVED"
  };
}
function upsertPattern(patterns, record) {
  const { source } = record;
  const activity = record.activity;
  const digest = isRecord4(activity.digest) ? activity.digest : {};
  let pattern = patterns.find((item) => item.fingerprint === activity.fingerprint);
  if (!pattern) {
    pattern = patternFromActivity(activity);
    patterns.push(pattern);
  }
  const ref = { source: source.id, id: String(activity.id || "") };
  const refKey = `${ref.source}:${ref.id}`;
  const existingRefs = Array.isArray(pattern.activity_refs) ? pattern.activity_refs : [];
  const existingKeys = new Set(existingRefs.map((item) => `${item.source}:${item.id}`));
  if (!ref.id || existingKeys.has(refKey))
    return false;
  pattern.activity_refs = [...existingRefs, ref];
  pattern.source_hosts = unique([...pattern.source_hosts || [], source.host]);
  pattern.activity_ids = unique([...pattern.activity_ids, activity.id]);
  pattern.occurrences = pattern.activity_refs.length;
  pattern.project_ids = unique([...pattern.project_ids || [], activity.project]);
  pattern.projects = pattern.project_ids.length;
  pattern.first_seen = [pattern.first_seen, activity.started_at || activity.updated_at].filter(Boolean).sort()[0] || null;
  pattern.last_seen = [pattern.last_seen, activity.updated_at || activity.started_at].filter(Boolean).sort().at(-1) || null;
  pattern.high_value = Boolean(pattern.high_value || digest.high_value || activity.high_value || activity.metadata?.high_value);
  return true;
}
async function advanceIngestionState(records) {
  const state = await loadIngestionState();
  for (const { source, activity } of records) {
    const current = state.sources[source.id] || {};
    const seenAt = activity.updated_at || activity.started_at || current.last_seen_at || null;
    const recent = [activity.id, ...current.recent_ids || []].filter((id) => typeof id === "string" && id.length > 0);
    const next = {
      recent_ids: [...new Set(recent)].slice(0, 100)
    };
    next.last_seen_at = [current.last_seen_at, seenAt].filter((item) => typeof item === "string").sort().at(-1) || null;
    state.sources[source.id] = next;
  }
  await saveIngestionState(state);
}
async function indexNewActivities() {
  const started = Date.now();
  const records = (await readActivities2()).filter(({ activity }) => hasActivityContent(activity));
  const index = await readPatterns();
  let indexed = 0;
  for (const record of records) {
    if (upsertPattern(index.patterns, record))
      indexed++;
  }
  await writePatterns(index);
  await advanceIngestionState(records);
  const result = {
    mode: "incremental",
    indexed,
    patterns: index.patterns.length
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ activity }) => activity.digest || activity), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns }
  });
  await recordIntelligenceRun({
    stage: "pattern_judge",
    input,
    output: result,
    evidence_loaded: indexed,
    skills_loaded: 0,
    full_activity_load: true,
    full_skill_load: false,
    duration_ms: Date.now() - started,
    budget
  });
  return result;
}
async function rebuildPatternIndex() {
  const started = Date.now();
  const records = (await readActivities2({ includeIndexed: true })).filter(({ activity }) => hasActivityContent(activity));
  const previous = await readPatterns();
  const linked = new Map(previous.patterns.filter((item) => item.candidate_id).map((item) => [item.fingerprint, item]));
  const index = { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] };
  let indexed = 0;
  for (const record of records) {
    if (upsertPattern(index.patterns, record))
      indexed++;
  }
  for (const pattern of index.patterns) {
    const existing = linked.get(pattern.fingerprint);
    if (existing?.candidate_id !== undefined) {
      pattern.candidate_id = existing.candidate_id;
    }
    if (existing?.state !== undefined) {
      pattern.state = existing.state;
    }
  }
  await writePatterns(index);
  await advanceIngestionState(records);
  const result = {
    mode: "rebuild",
    indexed,
    patterns: index.patterns.length
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ activity }) => activity.digest || activity), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns }
  });
  await recordIntelligenceRun({
    stage: "pattern_judge",
    input,
    output: result,
    evidence_loaded: indexed,
    skills_loaded: 0,
    full_activity_load: true,
    full_skill_load: false,
    duration_ms: Date.now() - started,
    budget
  });
  return result;
}
async function queryPatterns(args = {}) {
  const config = await loadConfig();
  const minOccurrences = typeof config.intelligence?.candidate_min_occurrences === "number" ? config.intelligence.candidate_min_occurrences : 2;
  const limit = listLimit(args.limit);
  const index = await readPatterns();
  let patterns = index.patterns || [];
  if (args.state)
    patterns = patterns.filter((pattern) => pattern.state === args.state);
  if (args.since) {
    const since = args.since;
    patterns = patterns.filter((pattern) => (pattern.last_seen || pattern.first_seen || "") >= since);
  }
  if (args.eligible) {
    patterns = patterns.filter((pattern) => pattern.activity_refs?.length !== 0 || !pattern.activity_refs);
    patterns = patterns.filter((pattern) => pattern.high_value || pattern.type !== "routine" && pattern.occurrences >= minOccurrences);
  }
  patterns = patterns.slice().sort((a, b) => (b.last_seen || "").localeCompare(a.last_seen || "") || b.occurrences - a.occurrences);
  return { count: patterns.length, patterns: patterns.slice(0, limit).map((item) => pickFields2(item, args.fields)) };
}
async function handlePatternIndex(args = {}) {
  return withKnowledgeLock("patterns", () => args.mode === "rebuild" ? rebuildPatternIndex() : indexNewActivities());
}
async function handlePatternQuery(args = {}) {
  return queryPatterns(args);
}
async function handlePatternGet(args = {}) {
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === args.fingerprint);
  if (!pattern)
    throw Error("Pattern not found");
  return pickFields2(pattern, args.fields);
}

// plugins/foundry/src/core/candidates.ts
function isRecord5(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function text(value) {
  return typeof value === "string" ? value : "";
}
function normalizeEvidence(evidence = []) {
  return asArray(evidence).map((item) => typeof item === "string" ? { activity_id: item, reason: "" } : { ...isRecord5(item) ? item : {} });
}
function words(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
}
function jaccard(left, right) {
  if (!left.size || !right.size)
    return 0;
  let shared = 0;
  for (const token of left)
    if (right.has(token))
      shared += 1;
  return shared / new Set([...left, ...right]).size;
}
function recordText(item) {
  return [
    item.title,
    item.name,
    item.summary,
    item.description,
    item.domain,
    item.topic,
    ...asArray(item.tags),
    ...asArray(item.technologies)
  ].join(" ");
}
function scoreMatch(target, item) {
  if (target.fingerprint && target.fingerprint === item.fingerprint) {
    return { score: 1, reasons: ["fingerprint"] };
  }
  const titleScore = jaccard(words(target.title), words(item.title || item.name));
  const summaryScore = jaccard(words(target.summary), words(item.summary || item.description));
  const techScore = jaccard(words(asArray(target.technologies).join(" ")), words(asArray(item.technologies).join(" ")));
  const topicScore = jaccard(words(target.topic), words(item.topic));
  const tagScore = jaccard(words(asArray(target.tags).join(" ")), words(asArray(item.tags).join(" ")));
  const textScore = jaccard(words(recordText(target)), words(recordText(item)));
  const score = 0.35 * titleScore + 0.25 * summaryScore + 0.15 * techScore + 0.1 * topicScore + 0.1 * tagScore + 0.05 * textScore;
  return {
    score: Number(score.toFixed(3)),
    reasons: [
      titleScore >= 0.8 ? "title" : null,
      summaryScore >= 0.6 ? "summary" : null,
      techScore > 0 ? "technologies" : null,
      topicScore > 0 ? "topic" : null,
      tagScore > 0 ? "tags" : null
    ].filter((reason) => typeof reason === "string")
  };
}
async function readCandidates() {
  const candidatesDir = await knowledgeDirPath("candidates");
  const items = [];
  for (const file of await fs7.readdir(candidatesDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path10.join(candidatesDir, file));
    if (isRecord5(item))
      items.push(item);
  }
  return items;
}
async function readSkills() {
  const skillsDir = await knowledgeDirPath("skills");
  const items = [];
  for (const dir of await fs7.readdir(skillsDir).catch(() => [])) {
    const item = await readJson(path10.join(skillsDir, dir, "skill.json"));
    if (!isRecord5(item))
      continue;
    const { content: _content, ...summary } = item;
    items.push(summary);
  }
  return items;
}
function topMatches(target, items, limit) {
  return items.map((item) => ({ ...scoreMatch(target, item), item })).filter((match) => match.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ item, ...match }) => ({ ...match, ...item }));
}
function pickFields3(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
async function handleCandidateCreate(args) {
  return withKnowledgeLock("candidates", () => createCandidate(args));
}
async function createCandidate(args) {
  if (!args.title || !args.summary) {
    throw Error("title and summary are required");
  }
  const evidence = normalizeEvidence(args.evidence);
  const item = {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    id: newId("candidate"),
    title: args.title,
    summary: args.summary,
    domain: args.domain || null,
    topic: args.topic || null,
    tags: asArray(args.tags),
    technologies: asArray(args.technologies),
    fingerprint: args.fingerprint || args.pattern_fingerprint || null,
    occurrences: Number(args.occurrences) || evidence.length || 1,
    confidence: args.confidence ?? null,
    source: args.source || "codex",
    evidence,
    contributing_sources: asArray(args.contributing_sources || args.source_hosts),
    resolution: args.resolution || null,
    resolution_reason: args.resolution_reason || "",
    merge_target: args.merge_target || null,
    created_at: now(),
    updated_at: now(),
    state: args.state || "OPEN"
  };
  await writeJson(path10.join(await knowledgeDirPath("candidates"), `${item.id}.json`), item);
  await writeEvent("CandidateCreated", item);
  return item;
}
async function handleCandidateList(args = {}) {
  const limit = listLimit(args.limit);
  const items = await readCandidates();
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, candidates: items.slice(0, limit) };
}
async function handleCandidateMatch(args = {}) {
  const limit = listLimit(args.limit || 5);
  const target = {
    title: text(args.title),
    summary: text(args.summary),
    topic: args.topic || null,
    tags: asArray(args.tags),
    technologies: asArray(args.technologies),
    fingerprint: args.fingerprint || args.pattern_fingerprint || null
  };
  const candidates = (await readCandidates()).filter((item) => item.state !== "REJECTED" && item.state !== "DROPPED");
  const skills = await readSkills();
  return {
    candidates: topMatches(target, candidates, limit),
    skills: topMatches(target, skills, limit)
  };
}
async function handleCandidateQuery(args = {}) {
  const limit = listLimit(args.limit);
  let candidates = await readCandidates();
  if (args.state)
    candidates = candidates.filter((candidate) => candidate.state === args.state);
  if (args.since) {
    const since = args.since;
    candidates = candidates.filter((candidate) => (candidate.updated_at || candidate.created_at || "") >= since);
  }
  candidates.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return {
    count: candidates.length,
    candidates: candidates.slice(0, limit).map((item) => pickFields3(item, args.fields))
  };
}
async function handleCandidateGet(args = {}) {
  const id = safeName(args.id, "id");
  const candidate = await readJson(path10.join(await knowledgeDirPath("candidates"), `${id}.json`));
  if (!isRecord5(candidate))
    throw Error("Candidate not found");
  return pickFields3(candidate, args.fields);
}
async function handleCandidateResolve(args = {}) {
  return withKnowledgeLock("candidates", () => resolveCandidate(args));
}
async function resolveCandidate(args = {}) {
  if (!args.title || !args.summary) {
    throw Error("title and summary are required");
  }
  const started = Date.now();
  const threshold = Number(args.threshold) || 0.62;
  const matches = await handleCandidateMatch(args);
  const budget = await checkContextBudget("candidate_resolver", {
    required: { title: args.title, summary: args.summary, technologies: args.technologies, tags: args.tags },
    recommended: { candidates: matches.candidates.slice(0, 5), skills: matches.skills.slice(0, 5) },
    optional: { evidence: normalizeEvidence(args.evidence).slice(0, 3) }
  });
  const bestCandidate = matches.candidates[0];
  const bestSkill = matches.skills[0];
  if (bestCandidate && bestCandidate.score >= threshold) {
    if (args.pattern_fingerprint)
      await linkPatternCandidate(args.pattern_fingerprint, bestCandidate.id);
    const result2 = {
      action: "matched",
      candidate: bestCandidate,
      resolution_reason: "matched existing Candidate",
      merge_target: { type: "candidate", id: bestCandidate.id, score: bestCandidate.score },
      matches
    };
    await writeEvent("CandidateResolved", result2);
    await recordIntelligenceRun({
      stage: "candidate_resolver",
      input: { args, matches },
      output: result2,
      evidence_loaded: normalizeEvidence(args.evidence).length,
      skills_loaded: matches.skills.length,
      full_activity_load: false,
      full_skill_load: false,
      cache_hit: true,
      duration_ms: Date.now() - started,
      budget
    });
    return result2;
  }
  if (bestSkill && bestSkill.score >= threshold) {
    const result2 = {
      action: "matched",
      candidate: null,
      resolution_reason: "matched existing Skill",
      merge_target: { type: "skill", id: bestSkill.name, score: bestSkill.score },
      matches
    };
    await writeEvent("CandidateResolved", result2);
    await recordIntelligenceRun({
      stage: "candidate_resolver",
      input: { args, matches },
      output: result2,
      evidence_loaded: normalizeEvidence(args.evidence).length,
      skills_loaded: matches.skills.length,
      full_activity_load: false,
      full_skill_load: false,
      cache_hit: true,
      duration_ms: Date.now() - started,
      budget
    });
    return result2;
  }
  const shouldDrop = !args.high_value && (Number(args.occurrences) || normalizeEvidence(args.evidence).length || 1) < 2;
  const candidate = await handleCandidateCreate({
    ...args,
    resolution: shouldDrop ? "DROP" : "CREATE",
    resolution_reason: shouldDrop ? "insufficient evidence" : "no local match",
    state: shouldDrop ? "DROPPED" : "OPEN"
  });
  if (args.pattern_fingerprint && !shouldDrop)
    await linkPatternCandidate(args.pattern_fingerprint, candidate.id);
  const result = { action: shouldDrop ? "dropped" : "created", candidate, matches };
  await writeEvent("CandidateResolved", result);
  await recordIntelligenceRun({
    stage: "candidate_resolver",
    input: { args, matches },
    output: result,
    evidence_loaded: normalizeEvidence(args.evidence).length,
    skills_loaded: matches.skills.length,
    full_activity_load: false,
    full_skill_load: false,
    cache_hit: false,
    duration_ms: Date.now() - started,
    budget
  });
  return result;
}
async function handleCandidateEvaluate(args) {
  return withKnowledgeLock("candidates", () => evaluateCandidate(args));
}
async function evaluateCandidate(args) {
  const file = path10.join(await knowledgeDirPath("candidates"), `${safeName(args.id, "id")}.json`);
  const item = await readJson(file);
  if (!isRecord5(item))
    throw Error("Candidate not found");
  item.evaluation = {
    result: args.result,
    reviewer: args.reviewer || "codex",
    evaluated_at: now()
  };
  item.state = args.result === "pass" ? "EVALUATED" : "REJECTED";
  await writeJson(file, item);
  await writeEvent("ReviewSubmitted", item);
  return item;
}

// plugins/foundry/src/core/events.ts
import fs8 from "node:fs/promises";
import path11 from "node:path";
async function handleEventList(args = {}) {
  const limit = listLimit(args.limit);
  const eventsDir = await knowledgeDirPath("events");
  const items = [];
  for (const file of await fs8.readdir(eventsDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path11.join(eventsDir, file));
    if (item && typeof item === "object" && !Array.isArray(item))
      items.push({ ...item, file });
  }
  items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return { count: items.length, events: items.slice(0, limit) };
}

// plugins/foundry/src/core/governance.ts
import path13 from "node:path";

// plugins/foundry/src/core/skill-index.ts
import fs9 from "node:fs/promises";
import path12 from "node:path";
var SKILL_INDEX_FILE = "skills.json";
function isRecord6(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function words2(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
}
function overlap(left, right) {
  if (!left.size || !right.size)
    return 0;
  let shared = 0;
  for (const token of left)
    if (right.has(token))
      shared += 1;
  return shared / new Set([...left, ...right]).size;
}
function pickFields4(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
function skillSummary(meta) {
  const { content: _content, ...summary } = meta;
  return summary;
}
async function skillIndexPath() {
  return path12.join(await knowledgeDirPath("indexes"), SKILL_INDEX_FILE);
}
async function readSkillMetadata() {
  const skillsDir = await knowledgeDirPath("skills");
  const items = [];
  for (const dir of await fs9.readdir(skillsDir).catch(() => [])) {
    const meta = await readJson(path12.join(skillsDir, dir, "skill.json"));
    if (isRecord6(meta))
      items.push(skillSummary(meta));
  }
  return items;
}
async function rebuildSkillIndex() {
  const skills = await readSkillMetadata();
  skills.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  const index = { schema_version: 1, generated_at: now(), skills };
  await writeJson(await skillIndexPath(), index);
  return { count: skills.length, skills };
}
async function querySkillIndex(args = {}) {
  const limit = listLimit(args.limit);
  const indexFile = await skillIndexPath();
  const storedIndex = await readJson(indexFile);
  const index = storedIndex && Array.isArray(storedIndex.skills) ? storedIndex : { skills: (await rebuildSkillIndex()).skills };
  let skills = index.skills;
  if (args.state)
    skills = skills.filter((skill) => skill.state === args.state);
  if (args.candidate_id)
    skills = skills.filter((skill) => skill.source_candidate === args.candidate_id);
  if (args.since) {
    const since = args.since;
    skills = skills.filter((skill) => (skill.updated_at || skill.created_at || "") >= since);
  }
  if (args.q) {
    const query = words2(args.q);
    skills = skills.map((skill) => ({
      ...skill,
      score: overlap(query, words2([skill.name, skill.description, skill.state].join(" ")))
    })).filter((skill) => skill.score > 0).sort((a, b) => b.score - a.score);
  }
  return { count: skills.length, skills: skills.slice(0, limit).map((skill) => pickFields4(skill, args.fields)) };
}
async function handleSkillIndex(args = {}) {
  return args.mode === "rebuild" ? rebuildSkillIndex() : querySkillIndex(args);
}

// plugins/foundry/src/core/governance.ts
var RESOLUTIONS = ["KEEP", "EVOLVE", "MERGE", "DEPRECATE", "RETIRE"];
var DESTRUCTIVE = new Set(["MERGE", "DEPRECATE", "RETIRE"]);
function isRecord7(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function skillName(skill) {
  return typeof skill.name === "string" ? skill.name : "";
}
async function skillsForGovernance() {
  return (await readSkillMetadata()).filter(isRecord7);
}
function words3(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
}
function overlap2(left, right) {
  if (!left.size || !right.size)
    return 0;
  let shared = 0;
  for (const token of left)
    if (right.has(token))
      shared += 1;
  return shared / new Set([...left, ...right]).size;
}
function skillText(skill) {
  return [skill.name, skill.description, ...arrayOfStrings(skill.tags)].join(" ");
}
function successRate(skill) {
  return skill.usage_count ? (skill.success_count || 0) / skill.usage_count : null;
}
async function skillRecord(name) {
  const skillName2 = safeName(name, "name");
  const file = path13.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const meta = await readJson(file);
  if (!isRecord7(meta))
    throw Error("Skill not found");
  return { file, meta };
}
function finding(type, skill, reason, extra = {}) {
  return { type, skill: skill.name, reason, ...extra };
}
async function handleGovernanceScan(args = {}) {
  const limit = listLimit(args.limit);
  const nowMs = Date.now();
  const staleDays = args.stale_days === undefined ? 90 : Number(args.stale_days);
  const skills = await skillsForGovernance();
  const findings = [];
  for (const skill of skills) {
    if (!skill.usage_count)
      findings.push(finding("unused", skill, "Skill has no recorded usage."));
    const rate = successRate(skill);
    if (rate !== null && (skill.usage_count || 0) >= 2 && rate < (Number(args.min_success_rate) || 0.5)) {
      findings.push(finding("low-success", skill, "Skill success rate is below threshold.", { success_rate: rate }));
    }
    if (skill.superseded_by)
      findings.push(finding("superseded", skill, `Skill is superseded by ${skill.superseded_by}.`));
    const timestamp = Date.parse(skill.last_used_at || skill.updated_at || skill.created_at || "");
    if (timestamp && nowMs - timestamp > staleDays * 24 * 60 * 60 * 1000) {
      findings.push(finding("stale", skill, "Skill has not been updated or used recently."));
    }
  }
  for (let left = 0;left < skills.length; left += 1) {
    for (let right = left + 1;right < skills.length; right += 1) {
      const leftSkill = skills[left];
      const rightSkill = skills[right];
      if (!leftSkill || !rightSkill)
        continue;
      const score = overlap2(words3(skillText(leftSkill)), words3(skillText(rightSkill)));
      if (score >= (Number(args.duplicate_threshold) || 0.6)) {
        findings.push(finding("duplicate", leftSkill, "Skill metadata overlaps another Skill.", {
          duplicate_of: rightSkill.name,
          score
        }));
      }
    }
  }
  return { count: findings.length, findings: findings.slice(0, limit) };
}
function addGraph(meta, field, value) {
  if (!value)
    return;
  meta[field] = [...new Set([...arrayOfStrings(meta[field]), value])];
}
function requireAction(value) {
  if (typeof value !== "string" || !RESOLUTIONS.includes(value)) {
    throw Error("action must be KEEP, EVOLVE, MERGE, DEPRECATE, or RETIRE");
  }
  return value;
}
async function handleGovernanceResolve(args = {}) {
  return withKnowledgeLock("skills", () => resolveGovernance(args));
}
async function resolveGovernance(args = {}) {
  const action = requireAction(args.action);
  const config = await loadConfig();
  if (DESTRUCTIVE.has(action) && config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can apply destructive governance actions");
  }
  const { file, meta } = await skillRecord(args.skill);
  meta.governance_status = action;
  meta.governance_reason = args.reason || "";
  if (action === "MERGE") {
    const target = safeName(args.target_skill, "target_skill");
    const targetRecord = await skillRecord(target);
    meta.state = "MERGED";
    meta.superseded_by = target;
    addGraph(meta, "related_to", target);
    addGraph(targetRecord.meta, "supersedes", skillName(meta));
    await writeJson(targetRecord.file, targetRecord.meta);
  }
  if (action === "DEPRECATE")
    meta.state = "DEPRECATED";
  if (action === "RETIRE")
    meta.state = "RETIRED";
  if (args.related_to)
    addGraph(meta, "related_to", args.related_to);
  if (args.depends_on)
    addGraph(meta, "depends_on", args.depends_on);
  if (args.conflicts_with)
    addGraph(meta, "conflicts_with", args.conflicts_with);
  await writeJson(file, meta);
  await rebuildSkillIndex();
  const result = { action, skill: meta.name, target_skill: args.target_skill || null, state: meta.state };
  await writeEvent("GovernanceResolved", result);
  return result;
}
async function handleSkillGraphValidate() {
  const skills = await skillsForGovernance();
  const names = new Set(skills.map((skill) => skill.name));
  const issues = [];
  for (const skill of skills) {
    for (const field of ["related_to", "depends_on", "supersedes", "conflicts_with"]) {
      for (const target of arrayOfStrings(skill[field])) {
        if (!names.has(target))
          issues.push({ skill: skill.name, field, target, issue: "missing_skill" });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

// plugins/foundry/src/core/hub.ts
import fs11 from "node:fs/promises";
import path15 from "node:path";

// plugins/foundry/src/core/migration.ts
import fs10 from "node:fs/promises";
import path14 from "node:path";
function isRecord8(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function needsMigration(config) {
  return Number(config?.hub_schema_version || config?.version || 1) < HUB_SCHEMA_VERSION;
}
async function countJsonFiles(home, dir) {
  const root = path14.join(home, dir);
  let count = 0;
  for (const file of await fs10.readdir(root).catch(() => [])) {
    if (file.endsWith(".json"))
      count += 1;
  }
  return count;
}
async function backupHub(home) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path14.join(home, "backups", `migration-v1-to-v2-${stamp}`);
  await fs10.mkdir(backup, { recursive: true });
  for (const dir of DIRS) {
    if (dir === "backups")
      continue;
    await fs10.cp(path14.join(home, dir), path14.join(backup, dir), { recursive: true, force: true }).catch(() => {});
  }
  await fs10.cp(path14.join(anchorHome, "config.json"), path14.join(backup, "config.json"), { force: true });
  return backup;
}
async function ensureKnowledgeDirs(home) {
  await Promise.all(KNOWLEDGE_DIRS.map((dir) => fs10.mkdir(path14.join(home, dir), { recursive: true })));
}
async function restoreHub(home, backup) {
  for (const dir of DIRS) {
    if (dir === "backups")
      continue;
    await fs10.rm(path14.join(home, dir), { recursive: true, force: true });
    await fs10.cp(path14.join(backup, dir), path14.join(home, dir), { recursive: true, force: true }).catch(() => {});
  }
  await fs10.cp(path14.join(backup, "config.json"), path14.join(anchorHome, "config.json"), { force: true });
}
async function migrateActivities(home) {
  const root = path14.join(home, "activities");
  let count = 0;
  for (const file of await fs10.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path14.join(root, file));
    if (!isRecord8(item))
      continue;
    item.schema_version = ACTIVITY_SCHEMA_VERSION;
    item.state ||= "NEW";
    item.recent_updates ||= item.updates || [];
    delete item.updates;
    item.history ||= {
      update_count: Array.isArray(item.recent_updates) ? item.recent_updates.length : 0,
      first_seen: item.started_at || item.created_at || null,
      last_seen: item.updated_at || null,
      key_points: item.key_points || [],
      segments: []
    };
    await writeJson(path14.join(root, file), item);
    count += 1;
  }
  return count;
}
async function migrateCandidates(home) {
  const root = path14.join(home, "candidates");
  let count = 0;
  for (const file of await fs10.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path14.join(root, file));
    if (!isRecord8(item))
      continue;
    item.schema_version = CANDIDATE_SCHEMA_VERSION;
    item.domain ||= null;
    item.topic ||= null;
    item.tags ||= [];
    item.technologies ||= [];
    item.fingerprint ||= null;
    item.occurrences ||= Array.isArray(item.evidence) ? item.evidence.length || 1 : 1;
    item.confidence ??= null;
    const evidenceItems = Array.isArray(item.evidence) ? item.evidence : [];
    item.evidence = evidenceItems.map((evidence) => typeof evidence === "string" ? { activity_id: evidence, reason: "" } : evidence);
    item.resolution ||= null;
    item.resolution_reason ||= "";
    item.merge_target ||= null;
    item.state ||= "OPEN";
    item.updated_at ||= item.created_at || new Date().toISOString();
    await writeJson(path14.join(root, file), item);
    count += 1;
  }
  return count;
}
async function migrateSkills(home) {
  const root = path14.join(home, "skills");
  let count = 0;
  for (const dir of await fs10.readdir(root).catch(() => [])) {
    const file = path14.join(root, dir, "skill.json");
    const item = await readJson(file);
    if (!isRecord8(item))
      continue;
    item.schema_version = SKILL_METADATA_SCHEMA_VERSION;
    item.source_candidate ??= null;
    item.state ||= "DRAFT";
    item.revision ||= 0;
    item.updated_at ||= item.created_at || new Date().toISOString();
    await writeJson(file, item);
    count += 1;
  }
  return count;
}
function unique2(values) {
  return [...new Set(values.filter(Boolean))];
}
function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
async function sourceHomes(hostHome) {
  const sources = await describeActivitySources();
  return [
    ...new Set([hostHome, ...sources.map((source) => source.root).filter((root) => Boolean(root))])
  ];
}
async function migratePatternsFromSource(source, target) {
  const sourceFile = path14.join(source, "indexes", "patterns.json");
  const sourceIndex = await readJson(sourceFile);
  if (!Array.isArray(sourceIndex?.patterns))
    return 0;
  const targetFile = path14.join(target, "indexes", "patterns.json");
  const targetIndex = await readJson(targetFile) || { schema_version: 1, patterns: [] };
  targetIndex.patterns = Array.isArray(targetIndex.patterns) ? targetIndex.patterns : [];
  let migrated = 0;
  for (const sourcePattern of sourceIndex.patterns) {
    if (!isRecord8(sourcePattern) || typeof sourcePattern.fingerprint !== "string")
      continue;
    let targetPattern = targetIndex.patterns.find((item) => item.fingerprint === sourcePattern.fingerprint);
    if (!targetPattern) {
      targetIndex.patterns.push(sourcePattern);
      migrated += 1;
      continue;
    }
    const refs = [...Array.isArray(targetPattern.activity_refs) ? targetPattern.activity_refs : []];
    for (const id of Array.isArray(sourcePattern.activity_ids) ? sourcePattern.activity_ids : []) {
      refs.push({ source: path14.basename(path14.dirname(source)), id });
    }
    targetPattern.activity_refs = unique2([
      ...refs.map((ref) => isRecord8(ref) ? `${ref.source}:${ref.id}` : null),
      ...Array.isArray(sourcePattern.activity_refs) ? sourcePattern.activity_refs.map((ref) => isRecord8(ref) ? `${ref.source}:${ref.id}` : null) : []
    ]).map((ref) => {
      const [sourceId, id] = String(ref).split(":");
      return { source: sourceId, id };
    });
    targetPattern.activity_ids = unique2([
      ...Array.isArray(targetPattern.activity_ids) ? targetPattern.activity_ids : [],
      ...Array.isArray(sourcePattern.activity_ids) ? sourcePattern.activity_ids : []
    ]);
    targetPattern.source_hosts = unique2([
      ...Array.isArray(targetPattern.source_hosts) ? targetPattern.source_hosts : [],
      ...Array.isArray(sourcePattern.source_hosts) ? sourcePattern.source_hosts : []
    ]);
    targetPattern.project_ids = unique2([
      ...Array.isArray(targetPattern.project_ids) ? targetPattern.project_ids : [],
      ...Array.isArray(sourcePattern.project_ids) ? sourcePattern.project_ids : []
    ]);
    targetPattern.occurrences = Array.isArray(targetPattern.activity_refs) ? targetPattern.activity_refs.length : Array.isArray(targetPattern.activity_ids) ? targetPattern.activity_ids.length : 0;
    targetPattern.projects = Array.isArray(targetPattern.project_ids) ? targetPattern.project_ids.length : 0;
    targetPattern.first_seen = [targetPattern.first_seen, sourcePattern.first_seen].filter((value) => typeof value === "string").sort()[0] || null;
    targetPattern.last_seen = [targetPattern.last_seen, sourcePattern.last_seen].filter((value) => typeof value === "string").sort().at(-1) || null;
    targetPattern.high_value = Boolean(targetPattern.high_value || sourcePattern.high_value);
    migrated += 1;
  }
  await writeJson(targetFile, { schema_version: 1, patterns: targetIndex.patterns });
  return migrated;
}
async function migrateCandidatesFromSource(source, target, conflicts) {
  const sourceDir = path14.join(source, "candidates");
  const targetDir = path14.join(target, "candidates");
  let migrated = 0;
  for (const file of await fs10.readdir(sourceDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const candidate = await readJson(path14.join(sourceDir, file));
    if (!isRecord8(candidate))
      continue;
    const targetFile = path14.join(targetDir, file);
    const existing = await readJson(targetFile);
    if (!existing) {
      await writeJson(targetFile, candidate);
      migrated += 1;
      continue;
    }
    if (!sameJson(existing, candidate)) {
      conflicts.push({
        type: "candidate",
        source,
        id: String(candidate.id || file),
        recommended_resolution: "review duplicate candidate before merging"
      });
    }
  }
  return migrated;
}
async function migrateSkillsFromSource(source, target, conflicts) {
  const sourceDir = path14.join(source, "skills");
  const targetDir = path14.join(target, "skills");
  let migrated = 0;
  for (const dir of await fs10.readdir(sourceDir).catch(() => [])) {
    const sourceSkill = path14.join(sourceDir, dir);
    const targetSkill = path14.join(targetDir, dir);
    const sourceMeta = await readJson(path14.join(sourceSkill, "skill.json"));
    if (!isRecord8(sourceMeta))
      continue;
    const targetMeta = await readJson(path14.join(targetSkill, "skill.json"));
    if (!targetMeta) {
      await fs10.cp(sourceSkill, targetSkill, { recursive: true, force: false });
      migrated += 1;
      continue;
    }
    const sourceContent = await fs10.readFile(path14.join(sourceSkill, "SKILL.md"), "utf8").catch(() => "");
    const targetContent = await fs10.readFile(path14.join(targetSkill, "SKILL.md"), "utf8").catch(() => "");
    if (sameJson(targetMeta, sourceMeta) || sourceContent === targetContent)
      continue;
    conflicts.push({
      type: "skill",
      source,
      id: dir,
      recommended_resolution: "manual merge required; target skill was not overwritten"
    });
  }
  return migrated;
}
async function migrateSharedKnowledge(hostHome) {
  const knowledgeHome2 = await resolveKnowledgeHome();
  await ensureKnowledgeDirs(knowledgeHome2);
  const conflicts = [];
  const migrated = { patterns: 0, candidates: 0, skills: 0 };
  const sources = (await sourceHomes(hostHome)).filter((source) => path14.resolve(source) !== path14.resolve(knowledgeHome2));
  for (const source of sources) {
    migrated.patterns += await migratePatternsFromSource(source, knowledgeHome2);
    migrated.candidates += await migrateCandidatesFromSource(source, knowledgeHome2, conflicts);
    migrated.skills += await migrateSkillsFromSource(source, knowledgeHome2, conflicts);
  }
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    sources,
    migrated,
    conflicts
  };
  await writeJson(path14.join(await knowledgeDirPath("indexes"), "migration-report.json"), report);
  return report;
}
async function migrationStatus() {
  const config = await loadConfig();
  const home = await resolveHome(config);
  const knowledge = await resolveKnowledgeHome();
  return {
    migration_required: needsMigration(config),
    from_schema_version: Number(config.hub_schema_version || config.version || 1),
    to_schema_version: HUB_SCHEMA_VERSION,
    hub: home,
    data_path: home,
    knowledge_path: knowledge,
    config_path: path14.join(anchorHome, "config.json")
  };
}
async function handleHubMigrate(args = {}) {
  const status = await migrationStatus();
  const counts = {
    activities: await countJsonFiles(status.hub, "activities"),
    candidates: await countJsonFiles(status.knowledge_path, "candidates"),
    skills: (await fs10.readdir(path14.join(status.knowledge_path, "skills")).catch(() => [])).length
  };
  if (!status.migration_required)
    return { ...status, dry_run: Boolean(args.dry_run), migrated: false, counts };
  if (args.dry_run || args.confirm !== true) {
    return { ...status, dry_run: true, migrated: false, counts, action: "confirm_required" };
  }
  const backup = await backupHub(status.hub);
  try {
    const shared_knowledge = await migrateSharedKnowledge(status.hub);
    const migrated = {
      activities: await migrateActivities(status.hub),
      candidates: await migrateCandidates(status.knowledge_path),
      skills: await migrateSkills(status.knowledge_path)
    };
    const config = await loadConfig();
    await saveConfig({ ...config, version: HUB_SCHEMA_VERSION, hub_schema_version: HUB_SCHEMA_VERSION });
    const result = { ...status, migration_required: false, migrated: true, backup, counts: migrated, shared_knowledge };
    await writeEvent("HubMigrated", result);
    return result;
  } catch (err) {
    await restoreHub(status.hub, backup);
    await writeEvent("HubMigrationFailed", {
      ...status,
      backup,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

// plugins/foundry/src/core/hub.ts
function isRecord9(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function handleHubInit(args = {}) {
  const config = await loadConfig();
  if ((config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION) {
    return { ...await migrationStatus(), initialized: false, action: "migration_required" };
  }
  if (args.maintainer !== undefined) {
    config.maintainer = args.maintainer;
  }
  if (args.automation_policy !== undefined) {
    if (!AUTOMATION_POLICIES.includes(args.automation_policy)) {
      throw Error("invalid automation_policy");
    }
    config.automation_policy = args.automation_policy;
  }
  const saved = await saveConfig(config);
  const home = await resolveHostHome(saved);
  const knowledge = await resolveKnowledgeHome();
  await fs11.mkdir(home, { recursive: true });
  await fs11.mkdir(knowledge, { recursive: true });
  await Promise.all([
    ...HOST_DIRS.map((dir) => fs11.mkdir(path15.join(home, dir), { recursive: true })),
    ...KNOWLEDGE_DIRS.map((dir) => fs11.mkdir(path15.join(knowledge, dir), { recursive: true }))
  ]);
  return {
    initialized: true,
    hub: home,
    data_path: home,
    knowledge_path: knowledge,
    config_path: path15.join(anchorHome, "config.json"),
    hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION,
    maintainer: saved.maintainer,
    automation_policy: saved.automation_policy
  };
}
async function handleHubConfig(args = {}) {
  const config = await loadConfig();
  const oldHome = await resolveHome(config);
  const newHome = args.path !== undefined ? path15.resolve(args.path) : oldHome;
  if (args.maintainer !== undefined) {
    config.maintainer = args.maintainer;
  }
  if (args.automation_policy !== undefined) {
    if (!AUTOMATION_POLICIES.includes(args.automation_policy)) {
      throw Error("invalid automation_policy");
    }
    config.automation_policy = args.automation_policy;
  }
  let movedFrom = null;
  if (args.path !== undefined && newHome !== oldHome) {
    movedFrom = oldHome;
    await fs11.mkdir(newHome, { recursive: true });
    for (const dir of DIRS) {
      const src = path15.join(oldHome, dir);
      const dst = path15.join(newHome, dir);
      await fs11.mkdir(dst, { recursive: true });
      for (const entry of await fs11.readdir(src).catch(() => [])) {
        await fs11.rename(path15.join(src, entry), path15.join(dst, entry));
      }
      await fs11.rm(src, { recursive: true, force: true });
    }
    config.hub_path = newHome;
  }
  const saved = await saveConfig(config);
  if (movedFrom) {
    return {
      ...saved,
      hub: newHome,
      data_path: newHome,
      moved_from: movedFrom,
      config_path: path15.join(anchorHome, "config.json"),
      hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION
    };
  }
  return {
    ...saved,
    hub: await resolveHome(saved),
    data_path: await resolveHome(saved),
    config_path: path15.join(anchorHome, "config.json"),
    hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION
  };
}
async function handleHubStatus() {
  const config = await loadConfig();
  const home = await resolveHostHome(config);
  const knowledge = await resolveKnowledgeHome();
  const hostCount = async (dir) => (await fs11.readdir(await hostDirPath(dir)).catch(() => [])).length;
  const knowledgeCount = async (dir) => (await fs11.readdir(await knowledgeDirPath(dir)).catch(() => [])).length;
  const locations = await dataLocations();
  const activities = await hostCount("activities");
  const candidates = await knowledgeCount("candidates");
  const skills = await knowledgeCount("skills");
  const nextAction = activities === 0 ? "capture_activity" : candidates === 0 ? "create_candidate" : skills === 0 ? "create_skill" : "review_or_cleanup";
  return {
    hub: home,
    data_path: home,
    knowledge_path: knowledge,
    config_path: path15.join(anchorHome, "config.json"),
    config,
    hub_schema_version: config.hub_schema_version || HUB_SCHEMA_VERSION,
    migration_required: (config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION,
    activities,
    candidates,
    skills,
    locations,
    next_action: nextAction
  };
}
async function dataLocations() {
  const practiceRoot = await resolveHostHome();
  const knowledgeRoot = await resolveKnowledgeHome();
  return {
    host: currentHost(),
    practice: {
      root: practiceRoot,
      sessions: await hostDirPath("sessions"),
      activities: await hostDirPath("activities"),
      archive: await hostDirPath("archive")
    },
    knowledge: {
      root: knowledgeRoot,
      patterns: path15.join(await knowledgeDirPath("indexes"), "patterns.json"),
      candidates: await knowledgeDirPath("candidates"),
      skills: await knowledgeDirPath("skills"),
      indexes: await knowledgeDirPath("indexes"),
      events: await knowledgeDirPath("events"),
      usage: await knowledgeDirPath("usage"),
      backups: await knowledgeDirPath("backups")
    },
    resolution: {
      host_home_source: hostHomeSource,
      knowledge_home_source: _knowledgeHomeSource,
      knowledge_home_source_key: _knowledgeHomeSource === "environment" ? "USORA_HOME" : null
    },
    activity_sources: await describeActivitySources()
  };
}
async function handleHubCleanup(args = {}) {
  const mode = args.mode || "generated";
  if (!["generated", "blank", "all"].includes(mode)) {
    throw Error("mode must be generated, blank or all");
  }
  if (mode === "all") {
    if (args.confirm !== true) {
      throw Error("all cleanup requires confirm=true");
    }
    return cleanAll();
  }
  if (mode === "blank")
    return archiveBlankActivities();
  return archiveGenerated();
}
async function archiveBlankActivities() {
  const activitiesDir = await hostDirPath("activities");
  const archiveDir = await hostDirPath("archive");
  const candidatesDir = await knowledgeDirPath("candidates");
  const protectedIds = new Set;
  async function readCandidateEvidence(dir) {
    for (const entry of await fs11.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const file = path15.join(dir, entry.name);
      if (entry.isDirectory()) {
        await readCandidateEvidence(file);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        const item = await readJson(file);
        if (!isRecord9(item) || !Array.isArray(item.evidence))
          continue;
        for (const evidence of item.evidence) {
          const id = typeof evidence === "string" ? evidence : isRecord9(evidence) ? evidence.activity_id : null;
          if (typeof id === "string")
            protectedIds.add(id);
        }
      }
    }
  }
  await readCandidateEvidence(candidatesDir);
  let archived = 0;
  let protectedCount = 0;
  for (const file of await fs11.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const source = path15.join(activitiesDir, file);
    const activity = await readJson(source);
    if (!isRecord9(activity) || hasActivityContent(activity))
      continue;
    if (typeof activity.id === "string" && protectedIds.has(activity.id)) {
      protectedCount++;
      continue;
    }
    const destination = path15.join(archiveDir, file);
    if (await fs11.stat(destination).then(() => true, () => false))
      continue;
    await fs11.rename(source, destination);
    archived++;
  }
  if (archived)
    await handlePatternIndex({ mode: "rebuild" });
  return { mode: "blank", archived, protected: protectedCount, action: "archived_blank_activities" };
}
async function cleanAll() {
  const home = await resolveHome();
  const counts = {};
  for (const dir of DIRS) {
    const target = path15.join(home, dir);
    const files = await fs11.readdir(target).catch(() => []);
    counts[dir] = files.length;
    await fs11.rm(target, { recursive: true, force: true });
    await fs11.mkdir(target, { recursive: true });
  }
  return {
    mode: "all",
    counts,
    hub: home,
    data_path: home,
    config_path: path15.join(anchorHome, "config.json"),
    action: "deleted_all_hub_data"
  };
}
async function archiveGenerated() {
  let archived = 0;
  const activitiesDir = await hostDirPath("activities");
  const archiveDir = await hostDirPath("archive");
  for (const file of await fs11.readdir(activitiesDir)) {
    if (!file.endsWith(".json"))
      continue;
    const source = path15.join(activitiesDir, file);
    const item = await readJson(source);
    if (isRecord9(item) && (ARCHIVABLE_STATES.includes(String(item.state)) || item.skill_id)) {
      await fs11.rename(source, path15.join(archiveDir, file));
      archived++;
    }
  }
  return { mode: "generated", archived, action: "archived_generated_activities" };
}
async function handleHubDoctor() {
  const config = await loadConfig();
  const home = await resolveHome(config);
  const counts = {};
  const checks = [];
  for (const dir of DIRS) {
    const target = path15.join(home, dir);
    try {
      counts[dir] = (await fs11.readdir(target)).length;
      checks.push({ name: `${dir}_dir`, ok: true, path: target });
    } catch (err) {
      counts[dir] = 0;
      checks.push({
        name: `${dir}_dir`,
        ok: false,
        path: target,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }
  const skillDirs = await fs11.readdir(path15.join(home, "skills")).catch(() => []);
  const orphanSkills = [];
  for (const dir of skillDirs) {
    const meta = await readJson(path15.join(home, "skills", dir, "skill.json"));
    if (!meta)
      orphanSkills.push(dir);
  }
  checks.push({ name: "skill_metadata", ok: orphanSkills.length === 0, orphan_skills: orphanSkills });
  return {
    ok: checks.every((check) => check.ok),
    hub: home,
    data_path: home,
    config_path: path15.join(anchorHome, "config.json"),
    hub_schema_version: config.hub_schema_version || HUB_SCHEMA_VERSION,
    migration_required: (config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION,
    config,
    counts,
    checks
  };
}

// plugins/foundry/src/core/hub-query.ts
import fs12 from "node:fs/promises";
import path16 from "node:path";
var COLLECTIONS = ["activities", "sessions", "events", "candidates", "skills", "indexes"];
function isRecord10(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function collection(value) {
  if (typeof value !== "string" || !COLLECTIONS.includes(value)) {
    throw Error(`collection must be one of: ${COLLECTIONS.join(", ")}`);
  }
  return value;
}
function pickFields5(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
async function hostRoots(host) {
  const seen = new Set;
  const result = [];
  for (const source of await describeActivitySources()) {
    if (source.host !== host || !source.root)
      continue;
    const key = path16.resolve(source.root).toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    result.push({ id: source.id, host: source.host, root: source.root });
  }
  return result;
}
async function readJsonDir(dir, fields) {
  const items = [];
  for (const file of await fs12.readdir(dir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path16.join(dir, file));
    if (isRecord10(item))
      items.push(pickFields5({ ...item, file }, fields));
  }
  return items;
}
async function readSkills2(dir, fields) {
  const items = [];
  for (const entry of await fs12.readdir(dir).catch(() => [])) {
    const item = await readJson(path16.join(dir, entry, "skill.json"));
    if (isRecord10(item))
      items.push(pickFields5({ ...item, dir: entry }, fields));
  }
  return items;
}
async function readCollection(root, name, fields) {
  const dir = path16.join(root, name);
  return name === "skills" ? readSkills2(dir, fields) : readJsonDir(dir, fields);
}
async function handleHubQuery(args = {}) {
  const host = safeName(args.host || "codex", "host");
  const name = collection(args.collection || "activities");
  const limit = listLimit(args.limit);
  const roots = await hostRoots(host);
  if (roots.length === 0)
    return { host, collection: name, available: false, count: 0, records: [] };
  const records = [];
  for (const root of roots) {
    for (const item of await readCollection(root.root, name, args.fields)) {
      records.push({ source: root.id, host: root.host, root: root.root, ...item });
    }
  }
  records.sort((a, b) => String(b.updated_at || b.timestamp || b.created_at || "").localeCompare(String(a.updated_at || a.timestamp || a.created_at || "")));
  return { host, collection: name, available: true, count: records.length, records: records.slice(0, limit) };
}

// plugins/foundry/src/core/cache.ts
import fs13 from "node:fs/promises";
import path17 from "node:path";
import os3 from "node:os";
import { fileURLToPath as fileURLToPath2 } from "node:url";
async function handlePluginCacheCleanup(args = {}) {
  const pluginRoot = path17.resolve(path17.dirname(fileURLToPath2(import.meta.url)), "../..");
  const cacheRoot = path17.dirname(pluginRoot);
  const currentVersion = path17.basename(pluginRoot);
  const home = path17.resolve(os3.homedir()).toLowerCase();
  const normalizedPluginRoot = path17.resolve(pluginRoot).toLowerCase();
  const isKnownHostCache = normalizedPluginRoot.startsWith(home) && (normalizedPluginRoot.includes(`${path17.sep}.codex${path17.sep}`) || normalizedPluginRoot.includes(`${path17.sep}.codebuddy${path17.sep}`)) && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(currentVersion);
  if (!isKnownHostCache) {
    return {
      ok: false,
      action: "not_installed_cache",
      message: "Usora is not running from a versioned Codex or CodeBuddy installed plugin cache. Install or upgrade Usora first, then clean old caches.",
      plugin_root: pluginRoot
    };
  }
  const oldCaches = [];
  for (const entry of await fs13.readdir(cacheRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || entry.name === currentVersion)
      continue;
    const fullPath = path17.join(cacheRoot, entry.name);
    if (!isInside2(cacheRoot, fullPath)) {
      throw Error(`Refusing to inspect path outside Usora plugin cache: ${fullPath}`);
    }
    oldCaches.push({ version: entry.name, path: fullPath });
  }
  if (args.confirm !== true) {
    return {
      ok: true,
      dry_run: true,
      action: "preview_old_plugin_caches",
      current_version: currentVersion,
      cache_root: cacheRoot,
      old_caches: oldCaches,
      deleted: 0
    };
  }
  for (const cache of oldCaches) {
    if (!isInside2(cacheRoot, cache.path)) {
      throw Error(`Refusing to delete path outside Usora plugin cache: ${cache.path}`);
    }
    await fs13.rm(cache.path, { recursive: true, force: true });
  }
  return {
    ok: true,
    dry_run: false,
    action: "deleted_old_plugin_caches",
    current_version: currentVersion,
    cache_root: cacheRoot,
    old_caches: oldCaches,
    deleted: oldCaches.length
  };
}

// plugins/foundry/src/core/portability/export.ts
import fs14 from "node:fs/promises";
import path18 from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// packages/shared/src/zip.ts
var MAX_ZIP32 = 4294967295;
var UTF8_FLAG = 2048;
var FIXED_DOS_DATE = 23421;
var crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0;bit < 8; bit++)
    value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function crc32(data) {
  let crc = 4294967295;
  for (const byte of data)
    crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  return (crc ^ 4294967295) >>> 0;
}
function validateArchivePaths(paths) {
  const seen = new Set;
  const normalized = [];
  for (const file of paths) {
    const parts = file.split("/");
    if (!file || Buffer.from(file, "utf8").toString("utf8") !== file || /[\\:*?"<>|]/.test(file) || [...file].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || Buffer.byteLength(file, "utf8") > 65535 || parts.some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
      throw Error(`ZIP_PATH: unsafe archive entry ${JSON.stringify(file)}`);
    }
    const key = file.normalize("NFC").toLowerCase();
    if (seen.has(key))
      throw Error(`ZIP_DUPLICATE: duplicate archive entry ${JSON.stringify(file)}`);
    seen.add(key);
    normalized.push(key);
  }
  for (const file of normalized) {
    const parts = file.split("/");
    for (let end = 1;end < parts.length; end++) {
      if (seen.has(parts.slice(0, end).join("/"))) {
        throw Error(`ZIP_PATH: file/directory collision for ${JSON.stringify(file)}`);
      }
    }
  }
}
function deterministicZip(entries) {
  if (entries.length > 65535)
    throw Error("ZIP_LIMIT: ZIP32 supports at most 65535 files");
  validateArchivePaths(entries.map((entry) => entry.path));
  const ordered = [...entries].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const chunks = [];
  const central = [];
  let offset = 0;
  let centralSize = 0;
  for (const entry of ordered) {
    const name = Buffer.from(entry.path, "utf8");
    const data = entry.data;
    if (!Buffer.isBuffer(data) || data.length > MAX_ZIP32)
      throw Error("ZIP_LIMIT: invalid ZIP32 file size");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(67324752, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(FIXED_DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(33639248, 0);
    directory.writeUInt16LE(3 << 8 | 20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(UTF8_FLAG, 8);
    directory.writeUInt16LE(FIXED_DOS_DATE, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE((32768 | (entry.mode ?? 420) & 511) << 16 >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    chunks.push(local, name, data);
    central.push(directory, name);
    offset += local.length + name.length + data.length;
    centralSize += directory.length + name.length;
    if (offset + centralSize + 22 > MAX_ZIP32)
      throw Error("ZIP_LIMIT: ZIP32 archive exceeds 4 GiB");
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(101010256, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

// plugins/foundry/src/core/portability/export.ts
function codeOf(error) {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}
function contains(parent, child) {
  const relative = path18.relative(parent, child);
  return relative === "" || !relative.startsWith(`..${path18.sep}`) && relative !== ".." && !path18.isAbsolute(relative);
}
async function lstatOrNull(file) {
  try {
    return await fs14.lstat(file);
  } catch (error) {
    if (codeOf(error) === "ENOENT")
      return null;
    throw error;
  }
}
async function assertRealDirectoryAncestors(directory) {
  const root = path18.parse(directory).root;
  let current = root;
  for (const component of directory.slice(root.length).split(path18.sep).filter(Boolean)) {
    current = path18.join(current, component);
    const stat = await lstatOrNull(current);
    if (!stat?.isDirectory() || stat.isSymbolicLink()) {
      throw Error("PORTABILITY_OUTPUT_PATH: output parent and ancestors must be existing directories without symlinks");
    }
  }
  const rootStat = await lstatOrNull(root);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    throw Error("PORTABILITY_OUTPUT_PATH: invalid filesystem root");
  }
}
async function protectedRoots() {
  const moduleDir = path18.dirname(fileURLToPath3(import.meta.url));
  const pluginRoot = path18.basename(moduleDir) === "dist" ? path18.resolve(moduleDir, "..") : path18.resolve(moduleDir, "..", "..", "..");
  const roots = [anchorHome, knowledgeHome, pluginRoot];
  try {
    const config = JSON.parse(await fs14.readFile(path18.join(anchorHome, "config.json"), "utf8"));
    if (typeof config.hub_path === "string" && config.hub_path)
      roots.push(path18.resolve(config.hub_path));
  } catch (error) {
    if (codeOf(error) !== "ENOENT") {
      throw Error("PORTABILITY_OUTPUT_PATH: existing Hub configuration is unreadable; fix it before export");
    }
  }
  const possibleRepository = path18.resolve(pluginRoot, "..", "..");
  try {
    const metadata = JSON.parse(await fs14.readFile(path18.join(possibleRepository, "package.json"), "utf8"));
    if (metadata.name === "usora")
      roots.push(possibleRepository);
  } catch {}
  const protectedPaths = new Set;
  for (const configuredRoot of roots) {
    const root = path18.resolve(configuredRoot);
    protectedPaths.add(root);
    let existing = root;
    const suffix = [];
    for (;; ) {
      try {
        const canonical = await fs14.realpath(existing);
        protectedPaths.add(path18.join(canonical, ...suffix));
        break;
      } catch (error) {
        if (codeOf(error) !== "ENOENT") {
          throw Error("PORTABILITY_OUTPUT_PATH: cannot resolve protected Hub/plugin paths safely");
        }
        const parent = path18.dirname(existing);
        if (parent === existing)
          throw Error("PORTABILITY_OUTPUT_PATH: protected path has no accessible root");
        suffix.unshift(path18.basename(existing));
        existing = parent;
      }
    }
  }
  return [...protectedPaths];
}
async function outputTarget(outputPath, name, format) {
  if (typeof outputPath !== "string" || !path18.isAbsolute(outputPath) || path18.sep !== "\\" && outputPath.includes("\\") || [...outputPath].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || /^[\\/]{2}/.test(outputPath) || outputPath.split(/[\\/]/).some((part) => part === "..")) {
    throw Error("PORTABILITY_OUTPUT_PATH: output_path must be an existing absolute directory without traversal or Windows/UNC syntax");
  }
  const parent = path18.resolve(outputPath);
  await assertRealDirectoryAncestors(parent);
  const target = path18.join(parent, format === "zip" ? `${name}.zip` : name);
  for (const root of await protectedRoots()) {
    if (contains(root, parent) || contains(root, target) || contains(target, root)) {
      throw Error("PORTABILITY_OUTPUT_PATH: output must not overlap Hub data, plugin files, or the Usora source repository");
    }
  }
  return target;
}
async function assertTargetType(target, format) {
  const stat = await lstatOrNull(target);
  if (!stat)
    return false;
  if (stat.isSymbolicLink() || (format === "directory" ? !stat.isDirectory() : !stat.isFile())) {
    throw Error("PORTABILITY_OUTPUT_PATH: existing export target must have the expected type and must not be a symlink");
  }
  return true;
}
function isRecord11(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function diagnostic(value) {
  return isRecord11(value) && typeof value.code === "string" && typeof value.message === "string" && (value.file === undefined || typeof value.file === "string");
}
function copyReport(value) {
  if (!isRecord11(value) || typeof value.valid !== "boolean" || !Array.isArray(value.errors) || !value.errors.every(diagnostic) || !Array.isArray(value.warnings) || !value.warnings.every(diagnostic) || !Array.isArray(value.files) || !value.files.every((file) => isRecord11(file) && typeof file.path === "string" && Number.isSafeInteger(file.bytes) && typeof file.bytes === "number" && file.bytes >= 0 && typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256)) || !Array.isArray(value.dependencies) || !value.dependencies.every((dependency) => isRecord11(dependency) && typeof dependency.kind === "string" && ["usora_mcp", "mcp", "runtime", "platform", "external_service", "credential", "dynamic_resource"].includes(dependency.kind) && typeof dependency.name === "string" && typeof dependency.required === "boolean" && typeof dependency.reason === "string") || !isRecord11(value.compatibility) || typeof value.compatibility.agent_skills !== "boolean" || typeof value.compatibility.independent !== "boolean" || !Array.isArray(value.compatibility.notes) || !value.compatibility.notes.every((note) => typeof note === "string"))
    throw Error("PORTABILITY_SNAPSHOT: a complete validation report is required");
  return {
    valid: value.valid,
    errors: value.errors.map(({ code, message, file }) => ({ code, message, ...file !== undefined ? { file } : {} })),
    warnings: value.warnings.map(({ code, message, file }) => ({
      code,
      message,
      ...file !== undefined ? { file } : {}
    })),
    files: value.files.map(({ path: filePath, bytes, sha256 }) => ({ path: filePath, bytes, sha256 })),
    dependencies: value.dependencies.map(({ kind, name, required, reason }) => ({ kind, name, required, reason })),
    compatibility: {
      agent_skills: value.compatibility.agent_skills,
      independent: value.compatibility.independent,
      notes: [...value.compatibility.notes]
    }
  };
}
function copySnapshot(value, report) {
  if (!isRecord11(value) || typeof value.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.name) || value.name.length > 64 || !isRecord11(value.source) || value.source.skill_id !== value.name || value.source.state !== "PUBLISHED" || typeof value.source.revision !== "number" || !Number.isSafeInteger(value.source.revision) || value.source.revision < 1 || !Array.isArray(value.files) || !value.files.length || value.files.length > 100 || !report.compatibility.agent_skills)
    throw Error("PORTABILITY_SNAPSHOT: a validated published Skill snapshot is required");
  let bytes = 0;
  const files = value.files.map((file) => {
    if (!isRecord11(file) || typeof file.path !== "string" || !Buffer.isBuffer(file.data) || file.data.length > 1024 * 1024 || file.mode !== undefined && (typeof file.mode !== "number" || !Number.isSafeInteger(file.mode) || file.mode < 0 || file.mode > 65535))
      throw Error("PORTABILITY_SNAPSHOT: invalid file path, buffer, size, or mode");
    bytes += file.data.length;
    if (bytes > 16 * 1024 * 1024)
      throw Error("PORTABILITY_SNAPSHOT: snapshot exceeds 16 MiB");
    return {
      path: file.path,
      data: Buffer.from(file.data),
      ...typeof file.mode === "number" ? { mode: file.mode } : {}
    };
  });
  if (!files.some((file) => file.path === "SKILL.md"))
    throw Error("PORTABILITY_SNAPSHOT: SKILL.md is required");
  validateArchivePaths(files.map((file) => `${value.name}/${file.path}`));
  const evidence = new Map(report.files.map((file) => [file.path, file]));
  if (report.files.length !== files.length || evidence.size !== files.length) {
    throw Error("PORTABILITY_SNAPSHOT: snapshot files do not match the validation report");
  }
  for (const file of files) {
    const entry = evidence.get(file.path);
    if (!entry || entry.bytes !== file.data.length || entry.sha256 !== createHash("sha256").update(file.data).digest("hex")) {
      throw Error("PORTABILITY_SNAPSHOT: snapshot bytes do not match the validation report; validate again");
    }
  }
  return {
    name: value.name,
    files,
    source: { skill_id: value.name, state: "PUBLISHED", revision: value.source.revision }
  };
}
async function exportSkillSnapshot(snapshot, report, args) {
  const format = args.format ?? "directory";
  const conflictPolicy = args.conflict ?? "error";
  const dryRun = args.dry_run ?? false;
  if (format !== "directory" && format !== "zip")
    throw Error("PORTABILITY_ARGUMENT: format must be directory or zip");
  if (conflictPolicy !== "error" && conflictPolicy !== "overwrite")
    throw Error("PORTABILITY_ARGUMENT: conflict must be error or overwrite");
  if (typeof dryRun !== "boolean")
    throw Error("PORTABILITY_ARGUMENT: dry_run must be boolean");
  report = copyReport(report);
  const outputPath = args.output_path;
  const base = { ...report, exported: false, dry_run: dryRun, target: null, format, conflict: false };
  if (!report.valid || report.errors.length)
    return base;
  snapshot = copySnapshot(snapshot, report);
  const target = await outputTarget(outputPath, snapshot.name, format);
  const exists3 = await assertTargetType(target, format);
  const preview = { ...base, target, conflict: exists3 };
  if (dryRun)
    return preview;
  if (exists3 && conflictPolicy === "error")
    throw Error("PORTABILITY_CONFLICT: export target exists; choose another parent or explicit conflict=overwrite");
  const parent = path18.dirname(target);
  const lock = path18.join(parent, `.usora-export-${path18.basename(target)}.lock`);
  try {
    await fs14.mkdir(lock, { mode: 448 });
  } catch (error) {
    if (codeOf(error) === "EEXIST")
      throw Error(`PORTABILITY_EXPORT_BUSY: export lock exists at ${lock}; retry after the export finishes. If a prior export stopped unexpectedly, remove this lock only after confirming that process is no longer running.`);
    throw Error(`PORTABILITY_EXPORT_FAILED: cannot claim target (${codeOf(error) || "I/O error"})`);
  }
  let stage = null;
  let backup = null;
  let preserveBackup = false;
  let sha256;
  let committed = false;
  let primaryError = null;
  const cleanupIssues = [];
  try {
    await outputTarget(outputPath, snapshot.name, format);
    if (await assertTargetType(target, format) && conflictPolicy === "error") {
      throw Error("PORTABILITY_CONFLICT: target appeared during export");
    }
    stage = await fs14.mkdtemp(path18.join(parent, `.usora-export-${snapshot.name}-`));
    const payload = path18.join(stage, "payload");
    if (format === "zip") {
      const archive = deterministicZip(snapshot.files.map((file) => ({ ...file, path: `${snapshot.name}/${file.path}` })));
      sha256 = createHash("sha256").update(archive).digest("hex");
      await fs14.writeFile(payload, archive, { flag: "wx", mode: 420 });
    } else {
      await fs14.mkdir(payload);
      for (const file of snapshot.files) {
        const full = path18.join(payload, ...file.path.split("/"));
        await fs14.mkdir(path18.dirname(full), { recursive: true });
        await fs14.writeFile(full, file.data, { flag: "wx", mode: (file.mode ?? 420) & 511 });
        await fs14.chmod(full, (file.mode ?? 420) & 511);
      }
    }
    await outputTarget(outputPath, snapshot.name, format);
    if (await assertTargetType(target, format)) {
      if (conflictPolicy === "error")
        throw Error("PORTABILITY_CONFLICT: target appeared during staging");
      backup = path18.join(stage, "previous");
      await fs14.rename(target, backup);
    }
    try {
      if (format === "zip" && conflictPolicy === "error") {
        try {
          await fs14.link(payload, target);
        } catch (error) {
          if (codeOf(error) === "EEXIST")
            throw Error("PORTABILITY_CONFLICT: target appeared during commit");
          throw error;
        }
      } else {
        await fs14.rename(payload, target);
      }
      committed = true;
    } catch (error) {
      if (backup) {
        try {
          await fs14.rename(backup, target);
          backup = null;
        } catch {
          preserveBackup = true;
          throw Error(`PORTABILITY_EXPORT_FAILED: commit and rollback failed; original target preserved at ${backup}`);
        }
      }
      throw error;
    }
  } catch (error) {
    primaryError = error instanceof Error && /^(?:PORTABILITY_|ZIP_)/.test(error.message) ? error : Error(`PORTABILITY_EXPORT_FAILED: export was not committed (${codeOf(error) || "I/O error"})`, {
      cause: error
    });
  } finally {
    for (const leftover of [...stage && !preserveBackup ? [stage] : [], lock]) {
      try {
        await fs14.rm(leftover, { recursive: true, force: true });
      } catch (error) {
        cleanupIssues.push({ path: leftover, code: codeOf(error) || "I/O error" });
      }
    }
  }
  if (primaryError) {
    if (!cleanupIssues.length)
      throw primaryError;
    throw Error(`${primaryError.message}; cleanup incomplete: ${cleanupIssues.map((issue) => `${issue.path} (${issue.code})`).join(", ")}`, { cause: primaryError });
  }
  if (!committed)
    throw Error("PORTABILITY_EXPORT_FAILED: export was not committed");
  const result = { ...preview, exported: true, ...sha256 ? { sha256 } : {} };
  if (cleanupIssues.length) {
    result.warnings = [
      ...report.warnings,
      {
        code: "EXPORT_CLEANUP_FAILED",
        message: "The export was committed, but temporary files or its lock could not be removed. See recovery for paths; remove a lock only after confirming its export process has stopped."
      }
    ];
    result.recovery = {
      cleanup: cleanupIssues,
      ...backup && stage && cleanupIssues.some((issue) => issue.path === stage) ? { backup_path: backup } : {},
      ...cleanupIssues.some((issue) => issue.path === lock) ? { lock_path: lock } : {}
    };
  }
  return result;
}

// plugins/foundry/src/core/portability/validate.ts
import fs15 from "node:fs/promises";
import { constants } from "node:fs";
import path20 from "node:path";
import { createHash as createHash2 } from "node:crypto";
import { TextDecoder } from "node:util";

// node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/index.js
var composer = require_composer();
var Document = require_Document();
var Schema = require_Schema();
var errors = require_errors();
var Alias = require_Alias();
var identity = require_identity();
var Pair = require_Pair();
var Scalar = require_Scalar();
var YAMLMap = require_YAMLMap();
var YAMLSeq = require_YAMLSeq();
var cst = require_cst();
var lexer = require_lexer();
var lineCounter = require_line_counter();
var parser = require_parser();
var publicApi = require_public_api();
var visit = require_visit();
var $Composer = composer.Composer;
var $Document = Document.Document;
var $Schema = Schema.Schema;
var $YAMLError = errors.YAMLError;
var $YAMLParseError = errors.YAMLParseError;
var $YAMLWarning = errors.YAMLWarning;
var $Alias = Alias.Alias;
var $isAlias = identity.isAlias;
var $isCollection = identity.isCollection;
var $isDocument = identity.isDocument;
var $isMap = identity.isMap;
var $isNode = identity.isNode;
var $isPair = identity.isPair;
var $isScalar = identity.isScalar;
var $isSeq = identity.isSeq;
var $Pair = Pair.Pair;
var $Scalar = Scalar.Scalar;
var $YAMLMap = YAMLMap.YAMLMap;
var $YAMLSeq = YAMLSeq.YAMLSeq;
var $Lexer = lexer.Lexer;
var $LineCounter = lineCounter.LineCounter;
var $Parser = parser.Parser;
var $parse = publicApi.parse;
var $parseAllDocuments = publicApi.parseAllDocuments;
var $parseDocument = publicApi.parseDocument;
var $stringify = publicApi.stringify;
var $visit = visit.visit;
var $visitAsync = visit.visitAsync;

// plugins/foundry/src/core/portability/content-analysis.ts
import path19 from "node:path";

// plugins/foundry/src/core/tool-catalog.ts
var USORA_TOOL_NAMES = [
  "hub_init",
  "hub_status",
  "hub_query",
  "hub_migrate",
  "hub_doctor",
  "hub_cleanup",
  "plugin_cache_cleanup",
  "hub_config",
  "activity_capture",
  "activity_list",
  "activity_digest_list",
  "activity_query",
  "activity_get",
  "context_budget",
  "candidate_create",
  "candidate_match",
  "candidate_resolve",
  "pattern_index",
  "pattern_query",
  "pattern_get",
  "candidate_list",
  "candidate_query",
  "candidate_get",
  "candidate_evaluate",
  "skill_create",
  "skill_generate",
  "skill_evolve",
  "skill_evaluate",
  "skill_publish",
  "skill_read",
  "skill_list",
  "skill_index",
  "skill_query",
  "skill_get",
  "skill_validate",
  "skill_export",
  "usage_capture",
  "governance_scan",
  "governance_resolve",
  "skill_graph_validate",
  "event_list",
  "telemetry_metrics"
];

// plugins/foundry/src/core/portability/content-analysis.ts
var CONTENT_ANALYSIS_LIMIT = 100;
var usoraToolNames = new Set(USORA_TOOL_NAMES);
var expressionLanguages = new Set([".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".rb", ".pl", ".ps1"]);
var secretPatterns = [
  /-----BEGIN (?:[A-Z0-9 ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bnpm_[A-Za-z0-9]{20,}\b/,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/,
  /\bBearer\s+(?!TOKEN\b|YOUR_|<|\$)[A-Za-z0-9._~-]{16,}/i,
  /https?:\/\/[^\s/:]+:[^\s/@]+@/i
];
var runtimePatterns = [
  ["Python", /(?:\bpython[23]?\s|^#![^\n]*\bpython[23]?\b|\bpip[3]?\s+(?:install|run)\b)/im],
  ["Node.js", /(?:\bnode\s+(?:scripts\/|[^\n ]+\.[mc]?js)|\b(?:npm|npx|pnpm|yarn)\s+|^#![^\n]*\bnode\b)/im],
  ["Bun", /\bbun\s+(?:run|x|install|scripts\/)/i],
  ["shell", /(?:^#![^\n]*\b(?:ba|z|da|k)?sh\b|\b(?:bash|sh|zsh)\s+scripts\/)/im],
  ["PowerShell", /\b(?:powershell|pwsh)(?:\.exe)?\s+/i],
  ["Windows command processor", /\bcmd(?:\.exe)?\s+\/[ck]\b/i],
  ["TypeScript runtime or compiler", /\b(?:tsx|ts-node|tsc|deno)\s+/i]
];
var extensionRuntimes = {
  ".py": "Python",
  ".js": "Node.js",
  ".mjs": "Node.js",
  ".cjs": "Node.js",
  ".ts": "TypeScript runtime or compiler",
  ".tsx": "TypeScript runtime or compiler",
  ".sh": "shell",
  ".bash": "shell",
  ".rb": "Ruby",
  ".pl": "Perl",
  ".ps1": "PowerShell",
  ".cmd": "Windows command processor",
  ".bat": "Windows command processor"
};
function expressionContext(file, content) {
  if (expressionLanguages.has(path19.posix.extname(file).toLowerCase()))
    return () => true;
  if (!/\.mdx?$/i.test(file))
    return () => false;
  const ranges = [];
  let open = null;
  for (const fence of content.matchAll(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/gm)) {
    const marker = fence[1][0];
    const info = fence[2].trim();
    if (!open)
      open = {
        marker,
        width: fence[1].length,
        language: info.split(/[ \t]/, 1)[0],
        start: fence.index + fence[0].length
      };
    else if (marker === open.marker && fence[1].length >= open.width && !info) {
      if (/^(?:python|py|javascript|js|typescript|ts|ruby|perl|powershell|ps1)$/i.test(open.language))
        ranges.push({ start: open.start, end: fence.index });
      open = null;
    }
  }
  if (open && /^(?:python|py|javascript|js|typescript|ts|ruby|perl|powershell|ps1)$/i.test(open.language))
    ranges.push({ start: open.start, end: content.length });
  let current = 0;
  return (offset) => {
    while (current < ranges.length && ranges[current].end <= offset)
      current++;
    return current < ranges.length && ranges[current].start <= offset;
  };
}
function hasLiteralSecret(content, file) {
  const inExpression = expressionContext(file, content);
  const assignments = content.matchAll(/\b(?:api[_-]?key|(?:access[_-]?|auth[_-]?)?token|client[_-]?secret|password|passwd|secret(?:[_-]?key)?)\b["']?[ \t]*([=:])[ \t]*/gi);
  for (const assignment of assignments) {
    const code = inExpression(assignment.index);
    let start = assignment.index + assignment[0].length;
    if (code && assignment[1] === ":") {
      const type = /^[^\n=;'"{}]+=[ \t]*/.exec(content.slice(start));
      if (type)
        start += type[0].length;
    }
    const match = /^(?:"([^"\n]*)"|'([^'\n]*)'|([^\s,}\]]+))/.exec(content.slice(start));
    if (!match)
      continue;
    const quoted = match[1] !== undefined || match[2] !== undefined;
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!value || /^(?:\$|%|<|\{|YOUR_|example\b|placeholder\b|changeme\b|REDACTED\b|REPLACE_ME\b|process\.env\b|os\.environ\b|(?:os\.)?getenv\(|(?:config|args|options)\.|null$|undefined$|true$|false$)/i.test(value))
      continue;
    if (!quoted && code && /^(?:[A-Za-z_$][A-Za-z0-9_$]*(?:[.([?+*/%&|^<>=!-]|$)|[([{])/.test(value))
      continue;
    return true;
  }
  return false;
}
function analyzeSkillContent(content, file) {
  const result = {
    hasSecrets: secretPatterns.some((pattern) => pattern.test(content)) || hasLiteralSecret(content, file),
    dependencies: [],
    limited: false
  };
  const seen = new Set;
  function add(dependency) {
    const key = `${dependency.kind}\x00${dependency.name}`;
    if (seen.has(key))
      return;
    if (result.dependencies.length >= CONTENT_ANALYSIS_LIMIT) {
      result.limited = true;
      return;
    }
    seen.add(key);
    result.dependencies.push(dependency);
  }
  let usoraMentioned = /\busora\b[\s\S]{0,40}\bmcp\b|\bmcp\b[\s\S]{0,40}\b(?:usora|foundry)\b/i.test(content);
  if (!usoraMentioned) {
    for (const match of content.matchAll(/\b[a-z]+(?:_[a-z0-9]+)+\b/g)) {
      if (usoraToolNames.has(match[0])) {
        usoraMentioned = true;
        break;
      }
    }
  }
  if (usoraMentioned)
    add({
      kind: "usora_mcp",
      name: "Usora MCP",
      required: true,
      reason: `Usora tool or MCP reference in ${file}; provision Usora or replace the workflow before independent use.`
    });
  else if (/\bmcp(?:__|[ .:/_-]|\b)/i.test(content))
    add({
      kind: "mcp",
      name: "MCP server",
      required: true,
      reason: `MCP reference in ${file}; configure the required server in the target host.`
    });
  for (const [name, pattern] of runtimePatterns) {
    if (pattern.test(content))
      add({
        kind: "runtime",
        name,
        required: true,
        reason: `${name} command or interpreter in ${file}; availability is not verified by static validation.`
      });
  }
  const extension = path19.posix.extname(file).toLowerCase();
  const runtime = extensionRuntimes[extension];
  if (file.startsWith("scripts/"))
    add({
      kind: "runtime",
      name: runtime ?? "Unrecognized script runtime",
      required: true,
      reason: runtime ? `Bundled script ${file} needs its interpreter or compiler; availability is not verified.` : `Identify the interpreter, compiler or execution requirements for bundled script ${file} before independent use.`
    });
  if (file.startsWith("scripts/") && [".ps1", ".cmd", ".bat"].includes(extension) || /\b(?:powershell|pwsh|cmd\.exe|winget|choco|apt-get|apt install|brew install|systemctl|launchctl)\b|\b[A-Za-z]:\\/i.test(content))
    add({
      kind: "platform",
      name: "platform-specific command",
      required: true,
      reason: `Platform-specific script, command or path in ${file}; review target OS support.`
    });
  for (const match of content.matchAll(/\$\{?([A-Z][A-Z0-9_]*)\}?|(?:getenv|environ\.get)\(["']([A-Z][A-Z0-9_]*)["']\)/g)) {
    const name = match[1] || match[2];
    if (/TOKEN|KEY|SECRET|PASSWORD/.test(name))
      add({
        kind: "credential",
        name,
        required: true,
        reason: `Environment credential reference in ${file}; values must be supplied separately.`
      });
    if (result.limited)
      break;
  }
  if (!result.limited && /\benvironment\b|\bcredential|\bprovide\b|\brequires?\b/i.test(content)) {
    for (const match of content.matchAll(/\b[A-Z][A-Z0-9_]*\b/g)) {
      if (/TOKEN|KEY|SECRET|PASSWORD/.test(match[0]))
        add({
          kind: "credential",
          name: match[0],
          required: true,
          reason: `Environment credential reference in ${file}; values must be supplied separately.`
        });
      if (result.limited)
        break;
    }
  }
  if (!result.limited) {
    for (const match of content.matchAll(/https?:\/\/([^\s/<>"')]+)/g)) {
      const host = match[1].split("@").at(-1);
      add({
        kind: "external_service",
        name: host,
        required: true,
        reason: `External URL in ${file}; resource is not bundled and offline operation is not verified.`
      });
      if (result.limited)
        break;
    }
  }
  if (/\b(?:scripts|references|assets)\/(?:[^\s`]*\$|[^\s`]*\{|\*)/.test(content))
    add({
      kind: "dynamic_resource",
      name: "dynamic resource path",
      required: true,
      reason: `Dynamic path in ${file} cannot be resolved statically; replace it with explicit resource references.`
    });
  return result;
}

// plugins/foundry/src/core/portability/validate.ts
var PORTABILITY_LIMITS = {
  files: 100,
  file_bytes: 1024 * 1024,
  total_bytes: 16 * 1024 * 1024,
  analysis_entries: CONTENT_ANALYSIS_LIMIT
};
var portableName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var resourceRoots = new Set(["scripts", "references", "assets"]);
var textExtensions = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".svg",
  ".csv",
  ".tsv",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".py",
  ".sh",
  ".bash",
  ".ps1",
  ".cmd",
  ".bat",
  ".rb",
  ".pl",
  ".sql",
  ".html",
  ".css",
  ".ini",
  ".cfg",
  ".env",
  ".conf"
]);

class ValidationFailure extends Error {
  code;
  file;
  constructor(code, message, file) {
    super(message);
    this.code = code;
    this.file = file;
  }
}
function isRecord12(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function freshReport() {
  return {
    valid: false,
    errors: [],
    warnings: [],
    files: [],
    dependencies: [],
    compatibility: {
      agent_skills: false,
      independent: false,
      notes: [
        "Static eligibility is not proof of independent execution; dynamic references and undeclared dependencies require review.",
        "Host loading, allowed-tools support and runtime permissions vary; no automatic installation or execution is performed."
      ]
    }
  };
}
function diagnostic2(code, message, file) {
  return file === undefined ? { code, message } : { code, message, file };
}
function analysisLimit(report) {
  const item = diagnostic2("ANALYSIS_LIMIT", "Static analysis exceeds the 100-entry reference, dependency or diagnostic limit. Reduce the selected Skill's references and dependencies before retrying.");
  if (report.errors.some((entry) => entry.code === item.code))
    return;
  if (report.errors.length >= CONTENT_ANALYSIS_LIMIT)
    report.errors[CONTENT_ANALYSIS_LIMIT - 1] = item;
  else
    report.errors.push(item);
}
function addError(report, code, message, file) {
  const item = diagnostic2(code, message, file);
  if (report.errors.some((entry) => entry.code === code && entry.file === file && entry.message === message))
    return;
  if (report.errors.length >= CONTENT_ANALYSIS_LIMIT) {
    analysisLimit(report);
    return;
  }
  report.errors.push(item);
}
function addWarning(report, item) {
  if (report.warnings.some((entry) => entry.code === item.code && entry.file === item.file && entry.message === item.message))
    return;
  if (report.warnings.length >= CONTENT_ANALYSIS_LIMIT) {
    analysisLimit(report);
    return;
  }
  report.warnings.push(item);
}
function failureResult(error) {
  const report = freshReport();
  if (error instanceof ValidationFailure) {
    const trustedFile = ["SKILL.md", "skill.json", "config.json"].includes(error.file || "") ? error.file : undefined;
    report.errors.push(diagnostic2(error.code, error.message, trustedFile));
  } else {
    const code = isRecord12(error) && typeof error.code === "string" ? error.code : "";
    report.errors.push(diagnostic2(code === "EACCES" || code === "EPERM" ? "PERMISSION_DENIED" : "SOURCE_READ_FAILED", "Cannot read the selected Skill. Check file permissions and Hub integrity."));
  }
  return { report, snapshot: null };
}
async function requireRealDirectory(dir) {
  const full = path20.resolve(dir);
  let current = path20.parse(full).root;
  for (const segment of full.slice(current.length).split(path20.sep).filter(Boolean)) {
    current = path20.join(current, segment);
    const stat = await fs15.lstat(current);
    if (stat.isSymbolicLink())
      throw new ValidationFailure("SYMLINK_NOT_ALLOWED", "Replace symlink ancestors with real directories before validating.");
    if (!stat.isDirectory())
      throw new ValidationFailure("UNSAFE_PATH", "Skill ancestors must be real directories.");
  }
}
async function readSourceFile(absolute, relative) {
  try {
    await requireRealDirectory(path20.dirname(absolute));
  } catch (error) {
    if (isRecord12(error) && error.code === "ENOENT")
      throw new ValidationFailure(relative === "skill.json" ? "SKILL_NOT_FOUND" : "RESOURCE_NOT_FOUND", "A required Skill or resource file is missing. Repair the selected source reference before retrying.", relative);
    throw error;
  }
  let stat;
  try {
    stat = await fs15.lstat(absolute);
  } catch (error) {
    if (isRecord12(error) && error.code === "ENOENT") {
      throw new ValidationFailure(relative === "skill.json" ? "SKILL_NOT_FOUND" : "RESOURCE_NOT_FOUND", "A required Skill or resource file is missing. Repair the selected source reference before retrying.", relative);
    }
    throw error;
  }
  if (stat.isSymbolicLink())
    throw new ValidationFailure("SYMLINK_NOT_ALLOWED", "Symlinks are not included in portable Skills.", relative);
  if (!stat.isFile())
    throw new ValidationFailure("UNSAFE_FILE_TYPE", "Only regular files can be included in a Skill.", relative);
  if (stat.size > PORTABILITY_LIMITS.file_bytes)
    throw new ValidationFailure("FILE_TOO_LARGE", "A file exceeds the 1 MiB portability limit.", relative);
  const handle = await fs15.open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (opened.ino !== stat.ino || opened.dev !== stat.dev)
      throw new ValidationFailure("SNAPSHOT_CHANGED", "Skill changed while reading; retry validation.", relative);
    if (opened.size > PORTABILITY_LIMITS.file_bytes)
      throw new ValidationFailure("FILE_TOO_LARGE", "A file exceeds the 1 MiB portability limit.", relative);
    const buffer = Buffer.allocUnsafe(PORTABILITY_LIMITS.file_bytes + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const { bytesRead } = await handle.read(buffer, bytes, buffer.length - bytes, bytes);
      if (bytesRead === 0)
        break;
      bytes += bytesRead;
    }
    const after = await handle.stat();
    if (bytes > PORTABILITY_LIMITS.file_bytes)
      throw new ValidationFailure("FILE_TOO_LARGE", "A file exceeds the 1 MiB portability limit.", relative);
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs)
      throw new ValidationFailure("SNAPSHOT_CHANGED", "Skill changed while reading; retry validation.", relative);
    const data = Buffer.from(buffer.subarray(0, bytes));
    return { absolute, relative, data, mode: stat.mode & 511 };
  } finally {
    await handle.close();
  }
}
function decodeText(data, file) {
  try {
    const text2 = new TextDecoder("utf-8", { fatal: true }).decode(data);
    if (text2.includes("\x00"))
      throw Error("nul");
    return text2.replace(/^\uFEFF/, "").replace(/\r\n?/g, `
`);
  } catch {
    throw new ValidationFailure("INVALID_ENCODING", "Text files must contain valid UTF-8 without NUL bytes.", file);
  }
}
function parseMetadata(data) {
  try {
    const value = JSON.parse(decodeText(data, "skill.json"));
    if (!isRecord12(value))
      throw Error("object");
    return value;
  } catch (error) {
    if (error instanceof ValidationFailure)
      throw error;
    throw new ValidationFailure("INVALID_METADATA", "skill.json must be a valid JSON metadata object.", "skill.json");
  }
}
function validateFrontmatter(value, skillId, report) {
  if (typeof value.name !== "string" || value.name.length > 64 || !portableName.test(value.name) || value.name !== skillId) {
    addError(report, "INVALID_NAME", "Use the existing directory name: 1–64 lowercase ASCII letters/numbers with single internal hyphens.", "SKILL.md");
  }
  if (typeof value.description !== "string" || !value.description.trim() || value.description.length > 1024) {
    addError(report, "INVALID_DESCRIPTION", "Provide a nonempty description of at most 1024 characters.", "SKILL.md");
  }
  const allowed = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key))
      addError(report, "UNKNOWN_FRONTMATTER_FIELD", "Unsupported standard frontmatter field. Move custom fields into metadata.", "SKILL.md");
  }
  for (const key of ["license", "allowed-tools"]) {
    if (key in value && (typeof value[key] !== "string" || !value[key].trim()))
      addError(report, "INVALID_FRONTMATTER_FIELD", `${key} must be a nonempty string.`, "SKILL.md");
  }
  if ("compatibility" in value && (typeof value.compatibility !== "string" || !value.compatibility.trim() || value.compatibility.length > 500)) {
    addError(report, "INVALID_COMPATIBILITY", "compatibility must be a nonempty string of at most 500 characters.", "SKILL.md");
  }
  if ("metadata" in value && (!isRecord12(value.metadata) || Object.values(value.metadata).some((entry) => typeof entry !== "string"))) {
    addError(report, "INVALID_FRONTMATTER_METADATA", "metadata must map string keys to string values.", "SKILL.md");
  }
  if ("allowed-tools" in value)
    addWarning(report, diagnostic2("EXPERIMENTAL_ALLOWED_TOOLS", "allowed-tools is experimental; hosts may ignore it and it does not grant permissions.", "SKILL.md"));
}
function renderSkill(content, meta, skillId, report) {
  let fields;
  let body;
  let header;
  if (content.startsWith(`---
`) || content === "---") {
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(content);
    if (!match)
      throw new ValidationFailure("INVALID_YAML", "Close the YAML frontmatter with a standalone --- line.", "SKILL.md");
    const document = $parseDocument(match[1], { uniqueKeys: true, strict: true });
    let unsupported = false;
    let nonstringKey = false;
    $visit(document, (_key, node) => {
      if ($isAlias(node) || node && typeof node === "object" && "tag" in node && node.tag)
        unsupported = true;
      if ($isPair(node) && (!$isScalar(node.key) || typeof node.key.value !== "string"))
        nonstringKey = true;
    });
    if (document.errors.length || document.warnings.length || unsupported) {
      throw new ValidationFailure("INVALID_YAML", "Use valid YAML with unique keys, no aliases and no explicit/custom tags.", "SKILL.md");
    }
    if (nonstringKey)
      throw new ValidationFailure("INVALID_FRONTMATTER_METADATA", "YAML mappings must use string keys; quote numeric keys and replace complex keys with strings.", "SKILL.md");
    const parsed = document.toJS({ maxAliasCount: 0 });
    if (!isRecord12(parsed))
      throw new ValidationFailure("INVALID_YAML", "YAML frontmatter must be a mapping.", "SKILL.md");
    fields = parsed;
    body = match[2];
    header = `---
${match[1]}
---
`;
  } else {
    fields = { name: meta.name, description: meta.description };
    body = content;
    header = `---
name: ${skillId}
description: ${JSON.stringify(meta.description)}
---
`;
    addWarning(report, diagnostic2("FRONTMATTER_RENDERED", "Standard frontmatter was rendered from existing Skill metadata; the source is unchanged.", "SKILL.md"));
  }
  validateFrontmatter(fields, skillId, report);
  if (!body.trim())
    addError(report, "EMPTY_BODY", "Add actionable Markdown instructions; Usora portability requires a nonempty body.", "SKILL.md");
  if (body.split(`
`).length > 500)
    addWarning(report, diagnostic2("LONG_BODY", "Consider moving reference material out of SKILL.md (recommended fewer than 500 lines).", "SKILL.md"));
  let start = 0;
  let end = body.length;
  while (start < end && body.charCodeAt(start) === 10)
    start++;
  while (end > start && body.charCodeAt(end - 1) === 10)
    end--;
  return `${header}
${body.slice(start, end)}
`;
}
function referencePaths(content) {
  const refs = [];
  const seen = new Set;
  let limited = false;
  function add(value) {
    if (seen.has(value))
      return true;
    if (refs.length >= CONTENT_ANALYSIS_LIMIT) {
      limited = true;
      return false;
    }
    seen.add(value);
    refs.push(value);
    return true;
  }
  let remaining = content.replace(/!?\[[^[\]\n]*\]\([ \t]*(<[^<>\n]*>|[^\s()[\]<>]+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'))?[ \t]*\)/g, (_match, target) => {
    add(target.replace(/^<|>$/g, ""));
    return " ";
  });
  if (limited)
    return { references: refs, limited };
  remaining = remaining.replace(/^[ \t]*\[[^[\]\n]+\]:[ \t]*(<[^<>\n]*>|[^\s]+)(?:[ \t]|$)/gm, (_match, target) => {
    add(target.replace(/^<|>$/g, ""));
    return " ";
  });
  if (limited)
    return { references: refs, limited };
  remaining = remaining.replace(/`([^`\n]+)`/g, (match, code) => {
    const value = code.trim();
    if (/^(?:\.\/)?(?:scripts|references|assets)\//.test(value) && !/\s+-/.test(value)) {
      add(value);
      return " ";
    }
    return match;
  });
  if (limited)
    return { references: refs, limited };
  remaining = remaining.replace(/(["'])((?:\.\/)?(?:scripts|references|assets)\/[^"'\n]+)\1/g, (_match, _quote, target) => {
    add(target);
    return " ";
  });
  if (limited)
    return { references: refs, limited };
  for (const match of remaining.matchAll(/(?:^|[\s"'(<])((?:\.\/)?(?:scripts|references|assets)\/[A-Za-z0-9_./%+@=\-\u0080-\uFFFF]+)(?=$|[\s"')>`,;])/gm)) {
    if (!add(match[1]))
      break;
  }
  return { references: refs, limited };
}
function safeResourcePath(raw, file, report) {
  if (!raw || raw.startsWith("#"))
    return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) && !/^[A-Za-z]:/.test(raw)) {
    if (/^https?:/i.test(raw))
      addWarning(report, diagnostic2("EXTERNAL_REFERENCE", "External URL is not downloaded or bundled; target-host access is unverified.", file));
    else
      addError(report, "UNSAFE_PATH", "Only Skill-relative local resources and HTTP(S) reference URLs are supported.", file);
    return null;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(raw.split("#", 1)[0].split("?", 1)[0]);
  } catch {
    addError(report, "UNSAFE_PATH", "Resource path contains invalid percent encoding.", file);
    return null;
  }
  if (/^[A-Za-z]:|^[/\\]|\\/.test(decoded) || [...decoded].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || /%(?:2e|2f|5c|00)/i.test(decoded)) {
    addError(report, "UNSAFE_PATH", "Use root-relative resource paths without absolute/drive/UNC paths, backslashes or encoded escapes.", file);
    return null;
  }
  const segments = decoded.replace(/^\.\//, "").split("/");
  if (segments.some((part) => part === ".." || part === "." || !part || part.includes(":"))) {
    addError(report, "UNSAFE_PATH", "Resource path cannot traverse directories or contain empty/ambiguous segments.", file);
    return null;
  }
  if (segments[0] === "SKILL.md" && segments.length === 1)
    return "SKILL.md";
  if (segments.some((part) => /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    addError(report, "UNSAFE_PATH", "Resource names must avoid Windows reserved names and trailing dots/spaces.", file);
    return null;
  }
  if (!resourceRoots.has(segments[0])) {
    addError(report, "RESOURCE_NOT_ALLOWED", "Keep bundled resources under scripts/, references/ or assets/ and reference them from the Skill root.", file);
    return null;
  }
  if (segments.some((part) => /^(?:\.env(?:\..*)?|\.(?:npmrc|pypirc|netrc|aws|ssh)|credentials?(?:\..*)?|id_(?:rsa|ed25519)|.*\.(?:pem|p12|pfx|key))$/i.test(part))) {
    addError(report, "SENSITIVE_FILE", "Sensitive configuration/key files cannot be included in an export.", file);
    return null;
  }
  return segments.join("/");
}
async function collectOnce(dir, skillId) {
  const report = freshReport();
  const originals = [];
  await requireRealDirectory(dir);
  const metadata = await readSourceFile(path20.join(dir, "skill.json"), "skill.json");
  originals.push(metadata);
  const meta = parseMetadata(metadata.data);
  if (meta.name !== skillId)
    throw new ValidationFailure("INVALID_METADATA", "Skill metadata name must match the selected directory.", "skill.json");
  if (meta.schema_version !== undefined && meta.schema_version !== 1 && meta.schema_version !== 2)
    throw new ValidationFailure("INVALID_METADATA", "Unsupported Skill metadata schema; inspect Hub version before exporting.", "skill.json");
  if (meta.state !== "PUBLISHED" || !isRecord12(meta.evaluation) || meta.evaluation.result !== "pass")
    throw new ValidationFailure("SKILL_NOT_PUBLISHED", "Export requires a PUBLISHED Skill with a passing evaluation. Use the normal review and Maintainer publication workflow.", "skill.json");
  if (typeof meta.revision !== "number" || !Number.isSafeInteger(meta.revision) || meta.revision < 1)
    throw new ValidationFailure("INVALID_METADATA", "Published Skill must have a positive integer revision.", "skill.json");
  const markdown = await readSourceFile(path20.join(dir, "SKILL.md"), "SKILL.md");
  originals.push(markdown);
  const rendered = renderSkill(decodeText(markdown.data, "SKILL.md"), meta, skillId, report);
  const renderedData = Buffer.from(rendered, "utf8");
  if (renderedData.length > PORTABILITY_LIMITS.file_bytes)
    addError(report, "FILE_TOO_LARGE", "Rendered SKILL.md exceeds the 1 MiB limit.", "SKILL.md");
  const files = [{ path: "SKILL.md", data: renderedData, mode: 420 }];
  const states = new Map;
  const caseNames = new Map([["skill.md", "SKILL.md"]]);
  const seenReferences = new Set;
  const dependencyKeys = new Set;
  let limited = false;
  let secretDetected = false;
  let totalBytes = renderedData.length;
  function scanContent(content, relative) {
    const analysis = analyzeSkillContent(content, relative);
    secretDetected ||= analysis.hasSecrets;
    if (analysis.hasSecrets)
      addError(report, "SECRET_DETECTED", "Potential credential or private key detected. Values are omitted from diagnostics.");
    for (const dependency of analysis.dependencies) {
      const key = `${dependency.kind}\x00${dependency.name}`;
      if (dependencyKeys.has(key))
        continue;
      if (dependencyKeys.size >= CONTENT_ANALYSIS_LIMIT) {
        limited = true;
        analysisLimit(report);
        break;
      }
      dependencyKeys.add(key);
      report.dependencies.push(dependency);
    }
    if (analysis.limited) {
      limited = true;
      analysisLimit(report);
    }
  }
  async function follow(relative, content) {
    states.set(relative, "visiting");
    scanContent(content, relative);
    const extracted = referencePaths(content);
    if (extracted.limited) {
      limited = true;
      analysisLimit(report);
    }
    for (const raw of extracted.references) {
      if (limited)
        break;
      if (!seenReferences.has(raw)) {
        if (seenReferences.size >= CONTENT_ANALYSIS_LIMIT) {
          limited = true;
          analysisLimit(report);
          break;
        }
        seenReferences.add(raw);
      }
      const resource = safeResourcePath(raw, relative, report);
      if (!resource)
        continue;
      if (states.get(resource) === "visiting") {
        addWarning(report, diagnostic2("CYCLIC_REFERENCE", "Cyclic resource reference detected; review host loading order. Each file is included once.", relative));
        continue;
      }
      if (states.has(resource))
        continue;
      states.set(resource, "failed");
      const caseKey = resource.normalize("NFC").toLowerCase();
      const previous = caseNames.get(caseKey);
      if (previous && previous !== resource) {
        addError(report, "DUPLICATE_RESOURCE_NAME", "Resource names collide on case-insensitive/Unicode-normalizing filesystems.", relative);
        continue;
      }
      caseNames.set(caseKey, resource);
      if (files.length >= PORTABILITY_LIMITS.files) {
        addError(report, "FILE_LIMIT", "A Skill may include at most 100 files.", relative);
        continue;
      }
      try {
        const source = await readSourceFile(path20.join(dir, ...resource.split("/")), resource);
        originals.push(source);
        totalBytes += source.data.length;
        if (totalBytes > PORTABILITY_LIMITS.total_bytes) {
          addError(report, "TOTAL_SIZE_LIMIT", "Skill resources exceed the 16 MiB total limit.", resource);
          break;
        }
        files.push({ path: resource, data: source.data, mode: source.mode & 73 ? 493 : 420 });
        if (textExtensions.has(path20.posix.extname(resource).toLowerCase()) || resource.startsWith("scripts/")) {
          await follow(resource, decodeText(source.data, resource));
        } else {
          scanContent(source.data.toString("utf8").replaceAll("\x00", ""), resource);
          states.set(resource, "done");
        }
      } catch (error) {
        if (!(error instanceof ValidationFailure))
          throw error;
        addError(report, error.code, error.message, error.file);
      }
    }
    states.set(relative, "done");
  }
  await follow("SKILL.md", rendered);
  try {
    validateArchivePaths(files.map((file) => `${skillId}/${file.path}`));
  } catch {
    addError(report, "UNSAFE_PATH", "Skill/resource names must be unique and portable across POSIX and Windows filesystems, including reserved names and invalid filename characters.");
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  report.files = files.map((file) => ({
    path: file.path,
    bytes: file.data.length,
    sha256: createHash2("sha256").update(file.data).digest("hex")
  }));
  report.valid = report.errors.length === 0;
  report.compatibility.agent_skills = report.valid;
  report.compatibility.independent = report.valid && !report.dependencies.some((dependency) => dependency.required);
  if (secretDetected) {
    const redacted = freshReport();
    redacted.errors.push(diagnostic2("SECRET_DETECTED", "Potential credential or private key detected. Remove sensitive data from the selected Skill and rotate real credentials before retrying. Source-derived details are omitted."));
    return { result: { report: redacted, snapshot: null }, originals };
  }
  if (report.dependencies.length)
    addWarning(report, diagnostic2("DEPENDENCIES_REQUIRE_REVIEW", "Provision or replace reported dependencies before claiming independent operation."));
  const snapshot = {
    name: skillId,
    files,
    source: { skill_id: skillId, state: "PUBLISHED", revision: meta.revision }
  };
  return { result: { report, snapshot: report.valid ? snapshot : null }, originals };
}
async function validateSkillDirectory(dir, skillId) {
  if (!portableName.test(skillId) || skillId.length > 64)
    return failureResult(new ValidationFailure("INVALID_NAME", "Skill identifier must use 1–64 lowercase ASCII letters/numbers with single internal hyphens."));
  for (let attempt = 0;attempt < 3; attempt++) {
    try {
      const { result, originals } = await collectOnce(path20.resolve(dir), skillId);
      for (const original of originals) {
        const current = await readSourceFile(original.absolute, original.relative);
        if (!current.data.equals(original.data) || current.mode !== original.mode)
          throw new ValidationFailure("SNAPSHOT_CHANGED", "Skill changed while reading; retry validation.", original.relative);
      }
      return result;
    } catch (error) {
      if (error instanceof ValidationFailure && error.code === "SNAPSHOT_CHANGED" && attempt < 2)
        continue;
      return failureResult(error);
    }
  }
  return failureResult(new ValidationFailure("SNAPSHOT_CHANGED", "Skill changed repeatedly; retry when lifecycle writes finish."));
}
async function validateSkillSnapshot(skillId) {
  if (typeof skillId !== "string" || !skillId)
    return failureResult(new ValidationFailure("INVALID_ARGUMENT", "skill_id is required and must be a string."));
  if (!portableName.test(skillId) || skillId.length > 64)
    return failureResult(new ValidationFailure("INVALID_NAME", "Skill identifier must use 1–64 lowercase ASCII letters/numbers with single internal hyphens."));
  try {
    let configFile;
    try {
      configFile = await readSourceFile(path20.join(anchorHome, "config.json"), "config.json");
    } catch (error) {
      if (error instanceof ValidationFailure && error.code === "RESOURCE_NOT_FOUND" || isRecord12(error) && error.code === "ENOENT")
        throw new ValidationFailure("HUB_NOT_FOUND", "Initialize the Hub explicitly with hub_init before validating a Skill.");
      throw error;
    }
    let config;
    try {
      config = JSON.parse(decodeText(configFile.data, "config.json"));
    } catch {
      throw new ValidationFailure("INVALID_METADATA", "Hub config.json is malformed; inspect hub_doctor before exporting.", "config.json");
    }
    if (!isRecord12(config))
      throw new ValidationFailure("INVALID_METADATA", "Hub config.json must contain an object.", "config.json");
    const schema = config.hub_schema_version ?? config.version ?? 1;
    if (typeof schema !== "number" || schema < HUB_SCHEMA_VERSION)
      throw new ValidationFailure("MIGRATION_REQUIRED", "Hub schema v1 requires an explicit hub_migrate dry_run and confirmed migration before portability tools.");
    if (schema > HUB_SCHEMA_VERSION)
      throw new ValidationFailure("UNSUPPORTED_HUB_SCHEMA", "Hub schema is newer than this runtime; upgrade the plugin before exporting.");
    const dir = path20.join(await knowledgeDirPath("skills"), skillId);
    try {
      await requireRealDirectory(dir);
    } catch (error) {
      if (isRecord12(error) && error.code === "ENOENT")
        throw new ValidationFailure("SKILL_NOT_FOUND", "Selected Skill does not exist; use skill_query with a targeted filter.");
      throw error;
    }
    const writerLock = path20.join(await knowledgeDirPath("indexes"), "locks", "skills.lock");
    async function requireNoWriter() {
      const lock = await fs15.lstat(writerLock).catch((error) => {
        if (isRecord12(error) && error.code === "ENOENT")
          return null;
        throw error;
      });
      if (lock)
        throw new ValidationFailure("SOURCE_BUSY", "A Skill lifecycle writer holds the skills lock; retry after it completes. No lock is removed by validation.");
    }
    await requireNoWriter();
    const result = await validateSkillDirectory(dir, skillId);
    await requireNoWriter();
    const currentConfig = await readSourceFile(configFile.absolute, configFile.relative);
    if (!currentConfig.data.equals(configFile.data))
      throw new ValidationFailure("SNAPSHOT_CHANGED", "Hub configuration changed during validation; retry the read.");
    return result;
  } catch (error) {
    return failureResult(error);
  }
}

// plugins/foundry/src/core/skill-portability.ts
function validateArgs(args, exporting) {
  const allowed = new Set(exporting ? ["skill_id", "format", "output_path", "conflict", "dry_run"] : ["skill_id"]);
  for (const key of Object.keys(args)) {
    if (!allowed.has(key))
      throw Error(`INVALID_ARGUMENT: Unknown portability argument: ${key}`);
  }
  if (typeof args.skill_id !== "string" || !args.skill_id.trim()) {
    throw Error("INVALID_ARGUMENT: skill_id must be a nonempty existing Skill name");
  }
  if (!exporting)
    return;
  if (args.format !== undefined && args.format !== "directory" && args.format !== "zip") {
    throw Error("INVALID_ARGUMENT: format must be directory or zip");
  }
  if (args.conflict !== undefined && args.conflict !== "error" && args.conflict !== "overwrite") {
    throw Error("INVALID_ARGUMENT: conflict must be error or overwrite");
  }
  if (args.dry_run !== undefined && typeof args.dry_run !== "boolean") {
    throw Error("INVALID_ARGUMENT: dry_run must be a boolean");
  }
  if (typeof args.output_path !== "string" || !args.output_path.trim()) {
    throw Error("INVALID_ARGUMENT: output_path must be an existing absolute export parent directory");
  }
}
async function handleSkillValidate(args = {}) {
  validateArgs(args, false);
  const { report } = await validateSkillSnapshot(args.skill_id);
  return report;
}
async function handleSkillExport(args = {}) {
  validateArgs(args, true);
  const { report, snapshot } = await validateSkillSnapshot(args.skill_id);
  if (!report.valid || !snapshot) {
    return {
      ...report,
      exported: false,
      dry_run: args.dry_run ?? false,
      format: args.format ?? "directory",
      target: null
    };
  }
  return exportSkillSnapshot(snapshot, report, args);
}

// plugins/foundry/src/core/skills.ts
import fs16 from "node:fs/promises";
import path21 from "node:path";
function isRecord13(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function asArray2(value) {
  return Array.isArray(value) ? value : [];
}
function asRecords(value) {
  return asArray2(value).filter(isRecord13);
}
function stringValue(value) {
  return typeof value === "string" ? value : undefined;
}
function numberValue2(value) {
  return typeof value === "number" ? value : 0;
}
async function readCandidate(id) {
  return readJson(path21.join(await knowledgeDirPath("candidates"), `${safeName(id, "candidate_id")}.json`));
}
async function requirePassingCandidate(candidateId) {
  if (!candidateId)
    throw Error("candidate_id is required");
  const candidate = await readCandidate(candidateId);
  if (!isRecord13(candidate))
    throw Error("Candidate not found");
  if (candidate.state !== "EVALUATED" || candidate.evaluation?.result !== "pass") {
    throw Error("Skill requires a passing Candidate evaluation");
  }
  return candidate;
}
async function readSkillMeta(name) {
  const skillName2 = safeName(name, "name");
  const file = path21.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const meta = await readJson(file);
  if (!isRecord13(meta))
    throw Error("Skill not found");
  return { skillName: skillName2, file, meta, dir: path21.dirname(file) };
}
function generatedSkillName(candidate, fallback = "generated-skill") {
  const slug = String(candidate.title || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return slug || fallback;
}
function generatedSkillContent(candidate, similarSkills) {
  const evidence = asRecords(candidate.evidence).slice(0, 3).map((item) => `- ${item.activity_id || item.id || "evidence"}${item.reason ? `: ${item.reason}` : ""}`).join(`
`);
  const similar = similarSkills.slice(0, 3).map((skill) => `- ${skill.name}: ${skill.description || skill.state || "metadata only"}`).join(`
`);
  return [
    `# ${candidate.title}`,
    "",
    "## When To Use",
    candidate.summary,
    "",
    "## Evidence",
    evidence || "- No evidence refs provided.",
    "",
    "## Similar Skills Checked",
    similar || "- No similar Skill metadata found.",
    ""
  ].join(`
`);
}
async function handleSkillCreate(args) {
  return withKnowledgeLock("skills", () => createSkill(args));
}
async function createSkill(args) {
  if (!args.name || !args.content) {
    throw Error("name and content are required");
  }
  if (args.candidate_id)
    await requirePassingCandidate(args.candidate_id);
  const skillName2 = safeName(args.name, "name");
  const dir = path21.join(await knowledgeDirPath("skills"), skillName2);
  await fs16.mkdir(dir, { recursive: true });
  const meta = {
    schema_version: SKILL_METADATA_SCHEMA_VERSION,
    name: skillName2,
    description: args.description || "",
    content: args.content,
    source_candidate: args.candidate_id || null,
    generation: args.generation || null,
    state: "DRAFT",
    revision: 0,
    created_at: now(),
    updated_at: now()
  };
  await writeJson(path21.join(dir, "skill.json"), meta);
  const content = args.content.endsWith(`
`) ? args.content : `${args.content}
`;
  await fs16.writeFile(path21.join(dir, "SKILL.md"), content, "utf8");
  await rebuildSkillIndex();
  await writeEvent("SkillDraftCreated", meta);
  return meta;
}
async function handleSkillGenerate(args = {}) {
  return withKnowledgeLock("skills", () => generateSkill(args));
}
async function generateSkill(args = {}) {
  const started = Date.now();
  const candidate = await requirePassingCandidate(args.candidate_id);
  const similar = await querySkillIndex({
    q: [candidate.title, candidate.summary, ...asArray2(candidate.technologies)].join(" "),
    limit: 3
  });
  const similarSkills = similar.skills;
  const content = generatedSkillContent(candidate, similarSkills);
  const generation = {
    source: "candidate_spec",
    evidence_loaded: Math.min(asArray2(candidate.evidence).length, 3),
    skills_loaded: similarSkills.length,
    full_activity_load: false,
    full_skill_load: false
  };
  const budget = await checkContextBudget("skill_compiler", {
    required: { candidate: { ...candidate, evidence: asArray2(candidate.evidence).slice(0, 3) } },
    recommended: { similar_skills: similarSkills.slice(0, 3) },
    optional: {}
  });
  const skillArgs = {
    name: args.name || generatedSkillName(candidate),
    description: args.description || stringValue(candidate.summary),
    content,
    candidate_id: candidate.id,
    generation
  };
  const skill = await handleSkillCreate(skillArgs);
  await recordIntelligenceRun({
    stage: "skill_compiler",
    input: {
      candidate: { ...candidate, evidence: asArray2(candidate.evidence).slice(0, 3) },
      similar_skills: similarSkills
    },
    output: skill,
    evidence_loaded: generation.evidence_loaded,
    skills_loaded: generation.skills_loaded,
    full_activity_load: false,
    full_skill_load: false,
    cache_hit: false,
    duration_ms: Date.now() - started,
    budget
  });
  return skill;
}
function skillDelta(args, candidate, action) {
  return {
    schema_version: 1,
    action,
    reason: args.reason || "",
    evidence: asArray2(args.evidence || candidate?.evidence).slice(0, 3),
    source_candidate: candidate?.id || args.candidate_id || null,
    source_pattern: args.pattern_fingerprint || candidate?.fingerprint || null,
    changes: isRecord13(args.changes) ? args.changes : {},
    target_skill: args.target_skill || null,
    created_at: now()
  };
}
async function patchSkill(name, delta) {
  const { file, meta, dir } = await readSkillMeta(name);
  const current = await fs16.readFile(path21.join(dir, "SKILL.md"), "utf8").catch(() => meta.content || "");
  const append = typeof delta.changes.content_append === "string" ? delta.changes.content_append : "";
  const nextContent = typeof delta.changes.content === "string" ? delta.changes.content : append ? `${current.trimEnd()}

${append.trim()}
` : current;
  meta.content = nextContent;
  meta.description = stringValue(delta.changes.description) || meta.description;
  meta.source_candidate = delta.source_candidate || meta.source_candidate || null;
  meta.source_patterns = [...new Set([...asArray2(meta.source_patterns), delta.source_pattern].filter(Boolean))];
  meta.revision = numberValue2(meta.revision) + 1;
  meta.updated_at = now();
  meta.evolution = [...meta.evolution || [], delta].slice(-20);
  await writeJson(file, meta);
  await fs16.writeFile(path21.join(dir, "SKILL.md"), nextContent.endsWith(`
`) ? nextContent : `${nextContent}
`, "utf8");
  await rebuildSkillIndex();
  await writeEvent("SkillEvolved", { name: meta.name, revision: meta.revision, delta });
  return meta;
}
async function handleSkillEvolve(args = {}) {
  return withKnowledgeLock("skills", () => evolveSkill(args));
}
async function evolveSkill(args = {}) {
  if (args.action && !["CREATE", "PATCH", "NOOP", "SPLIT", "MERGE"].includes(args.action)) {
    throw Error("action must be CREATE, PATCH, NOOP, SPLIT, or MERGE");
  }
  const candidate = args.candidate_id ? await requirePassingCandidate(args.candidate_id) : null;
  const action = args.action || null;
  if ((action === "CREATE" || !action && !args.name) && !candidate) {
    throw Error("candidate_id is required to create a Skill evolution");
  }
  if (action === "CREATE")
    return handleSkillGenerate(args);
  const similar = candidate ? await querySkillIndex({
    q: [candidate.title, candidate.summary, ...asArray2(candidate.technologies)].join(" "),
    limit: 3
  }) : { skills: [] };
  const target = args.name || similar.skills[0]?.name;
  const resolvedAction = action || (target && (similar.skills[0]?.score || 0) >= (Number(args.threshold) || 0.2) ? "PATCH" : "CREATE");
  if (resolvedAction === "CREATE")
    return handleSkillGenerate({ ...args, candidate_id: candidate?.id || args.candidate_id });
  const delta = skillDelta(args, candidate, resolvedAction);
  if (resolvedAction === "PATCH") {
    if (!target)
      throw Error("name is required for PATCH");
    const patch = delta.changes.content_append ? delta : {
      ...delta,
      changes: {
        ...delta.changes,
        content_append: `## Evolution
${candidate?.summary || args.reason || "Updated behavior."}`
      }
    };
    return patchSkill(target, patch);
  }
  const result = { action: resolvedAction, target_skill: target || null, delta, similar_skills: similar.skills };
  await writeEvent("SkillEvolutionRecommended", result);
  return result;
}
async function handleSkillEvaluate(args) {
  return withKnowledgeLock("skills", () => evaluateSkill(args));
}
async function evaluateSkill(args) {
  const skillName2 = safeName(args.name, "name");
  const file = path21.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const item = await readJson(file);
  if (!isRecord13(item))
    throw Error("Skill not found");
  const result = args.result;
  if (result !== "pass" && result !== "fail") {
    throw Error("result must be pass or fail");
  }
  item.evaluation = {
    result,
    reviewer: args.reviewer || "codex",
    evaluated_at: now(),
    notes: args.notes || ""
  };
  item.state = result === "pass" ? "EVALUATED" : "REJECTED";
  item.updated_at = now();
  await writeJson(file, item);
  await rebuildSkillIndex();
  await writeEvent("SkillEvaluationCompleted", item);
  return item;
}
async function handleSkillPublish(args) {
  return withKnowledgeLock("skills", () => publishSkill(args));
}
async function publishSkill(args) {
  const config = await loadConfig();
  if (config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can publish");
  }
  const skillName2 = safeName(args.name, "name");
  const file = path21.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const meta = await readJson(file);
  if (!isRecord13(meta))
    throw Error("Skill not found");
  const evaluation = isRecord13(meta.evaluation) ? meta.evaluation : {};
  if (meta.state !== "EVALUATED" || evaluation.result !== "pass") {
    throw Error("Skill requires a passing evaluation");
  }
  meta.revision = numberValue2(meta.revision) + 1;
  meta.state = "PUBLISHED";
  meta.published_at = now();
  meta.updated_at = meta.published_at;
  await writeJson(file, meta);
  await rebuildSkillIndex();
  await writeEvent("SkillPublished", meta);
  return meta;
}
async function handleSkillRead(args) {
  const skillName2 = safeName(args.name, "name");
  const dir = path21.join(await knowledgeDirPath("skills"), skillName2);
  const meta = await readJson(path21.join(dir, "skill.json"));
  if (!isRecord13(meta))
    throw Error("Skill not found");
  const content = await fs16.readFile(path21.join(dir, "SKILL.md"), "utf8").catch(() => meta.content || "");
  const { content: _storedContent, ...metadata } = meta;
  return { metadata, content };
}
async function handleSkillList(args = {}) {
  const limit = listLimit(args.limit);
  const skillsDir = await knowledgeDirPath("skills");
  const items = [];
  for (const dir of await fs16.readdir(skillsDir).catch(() => [])) {
    const meta = await readJson(path21.join(skillsDir, dir, "skill.json"));
    if (!isRecord13(meta))
      continue;
    items.push(skillSummary(meta));
  }
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, skills: items.slice(0, limit) };
}
async function handleSkillQuery(args = {}) {
  const queryArgs = { limit: args.limit, fields: args.fields };
  const state = stringValue(args.state);
  const candidateId = stringValue(args.candidate_id);
  const q = stringValue(args.q);
  if (state)
    queryArgs.state = state;
  if (candidateId)
    queryArgs.candidate_id = candidateId;
  if (q)
    queryArgs.q = q;
  return querySkillIndex(queryArgs);
}
async function handleSkillGet(args = {}) {
  return handleSkillRead(args);
}

// plugins/foundry/src/core/usage.ts
import path22 from "node:path";
var OUTCOMES = ["success", "partial", "failure", "unknown"];
function isRecord14(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function bump(meta, outcome) {
  meta.usage_count = (meta.usage_count || 0) + 1;
  meta.success_count = (meta.success_count || 0) + (outcome === "success" ? 1 : 0);
  meta.partial_count = (meta.partial_count || 0) + (outcome === "partial" ? 1 : 0);
  meta.failure_count = (meta.failure_count || 0) + (outcome === "failure" ? 1 : 0);
}
async function handleUsageCapture(args = {}) {
  return withKnowledgeLock("skills", () => captureUsage(args));
}
async function captureUsage(args = {}) {
  const skill = safeName(args.skill, "skill");
  const outcome = args.outcome || "unknown";
  if (!OUTCOMES.includes(outcome))
    throw Error("outcome must be success, partial, failure, or unknown");
  const skillFile = path22.join(await knowledgeDirPath("skills"), skill, "skill.json");
  const meta = await readJson(skillFile);
  if (!isRecord14(meta))
    throw Error("Skill not found");
  const usedAt = args.used_at || now();
  const usage = {
    schema_version: 1,
    id: newId("usage"),
    session_id: args.session_id || null,
    skill,
    activity_id: args.activity_id || null,
    outcome,
    validation_evidence: args.validation_evidence || [],
    project: args.project || null,
    used_at: usedAt
  };
  await writeJson(path22.join(await knowledgeDirPath("usage"), `${usage.id}.json`), usage);
  bump(meta, outcome);
  meta.last_used_at = usedAt;
  meta.projects_used = [
    ...new Set([...meta.projects_used || [], args.project].filter((project) => typeof project === "string"))
  ];
  await writeJson(skillFile, meta);
  await rebuildSkillIndex();
  await writeEvent("UsageCaptured", usage);
  return { usage, skill: meta };
}

// plugins/foundry/src/mcp/tools/activity.ts
var activityTools = [
  {
    name: "activity_capture",
    description: "Create or update one Activity for the current MCP process. If session_id is supplied, repeated calls with the same value merge; otherwise the server uses its process-scoped session ID.",
    inputSchema: {
      type: "object",
      required: ["task", "result"],
      properties: {
        session_id: { type: "string" },
        task: { type: "string" },
        summary: { type: "string" },
        result: { type: "string" },
        key_points: { type: "array", items: { type: "string" } },
        context: { type: "string" },
        approach: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        outcome: { type: "string" },
        source: { type: "string" },
        project: { type: "string" },
        metadata: { type: "object" }
      }
    }
  },
  {
    name: "activity_list",
    description: "Deprecated: use activity_query. List recent Activities from the active Hub without loading archives.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "activity_digest_list",
    description: "List compact Activity digests for AI retrieval without full Activity records.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "activity_query",
    description: "Query Activities; defaults to compact digests and only returns full records when projection=full.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        projection: { type: "string", enum: ["digest", "full"] },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "activity_get",
    description: "Read one full Activity record by id; use only when a digest is insufficient.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/candidate.ts
var candidateTools = [
  {
    name: "context_budget",
    description: "Estimate context size for a Foundry intelligence stage using chars/4 token estimates and emit overflow events when limits are exceeded.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: ["pattern_judge", "candidate_resolver", "skill_compiler", "evaluator"] },
        required: { type: "object" },
        recommended: { type: "object" },
        optional: { type: "object" }
      }
    }
  },
  {
    name: "candidate_create",
    description: "Create a Candidate from an observed reusable pattern; do not create one for a one-off task.",
    inputSchema: {
      type: "object",
      required: ["title", "summary"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        domain: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        occurrences: { type: "number" },
        confidence: { type: "number" },
        evidence: {
          type: "array",
          items: {
            anyOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  activity_id: { type: "string" },
                  reason: { type: "string" }
                }
              }
            ]
          }
        },
        source: { type: "string" }
      }
    }
  },
  {
    name: "candidate_match",
    description: "Return local Candidate and Skill metadata matches without reading Skill content.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "candidate_resolve",
    description: "Resolve a Candidate proposal locally: match an existing Candidate/Skill, create a new Candidate, or drop low-evidence input.",
    inputSchema: {
      type: "object",
      required: ["title", "summary"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        domain: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        occurrences: { type: "number" },
        confidence: { type: "number" },
        high_value: { type: "boolean" },
        threshold: { type: "number" },
        evidence: {
          type: "array",
          items: {
            anyOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  activity_id: { type: "string" },
                  reason: { type: "string" }
                }
              }
            ]
          }
        },
        source: { type: "string" }
      }
    }
  },
  {
    name: "pattern_index",
    description: "Update the local Pattern index from Activity digests. Defaults to incremental NEW Activity indexing.",
    inputSchema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["incremental", "rebuild"] } }
    }
  },
  {
    name: "pattern_query",
    description: "Query local Pattern metadata without loading full Activities.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        eligible: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "pattern_get",
    description: "Read one Pattern metadata record by fingerprint.",
    inputSchema: {
      type: "object",
      required: ["fingerprint"],
      properties: {
        fingerprint: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "candidate_list",
    description: "Deprecated: use candidate_query. List recent Candidates.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "candidate_query",
    description: "Query Candidate records with limit/state/since and optional field projection.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "candidate_get",
    description: "Read one Candidate record by id.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "candidate_evaluate",
    description: "Evaluate a Candidate as pass or fail and record the reviewer.",
    inputSchema: {
      type: "object",
      required: ["id", "result"],
      properties: {
        id: { type: "string" },
        result: { type: "string", enum: ["pass", "fail"] },
        reviewer: { type: "string" }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/governance.ts
var governanceTools = [
  {
    name: "governance_scan",
    description: "Scan Skill metadata for unused, low-success, duplicate, superseded, and stale Skills.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        min_success_rate: { type: "number" },
        duplicate_threshold: { type: "number" },
        stale_days: { type: "number" }
      }
    }
  },
  {
    name: "governance_resolve",
    description: "Apply an auditable governance resolution. MERGE, DEPRECATE, and RETIRE require the configured Maintainer.",
    inputSchema: {
      type: "object",
      required: ["skill", "action"],
      properties: {
        skill: { type: "string" },
        action: { type: "string", enum: ["KEEP", "EVOLVE", "MERGE", "DEPRECATE", "RETIRE"] },
        target_skill: { type: "string" },
        reason: { type: "string" },
        actor: { type: "string" },
        related_to: { type: "string" },
        depends_on: { type: "string" },
        conflicts_with: { type: "string" }
      }
    }
  },
  {
    name: "skill_graph_validate",
    description: "Validate Skill graph references: related_to, depends_on, supersedes, and conflicts_with.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "event_list",
    description: "List recent lifecycle events.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "telemetry_metrics",
    description: "Summarize IntelligenceRun and CandidateResolved telemetry with trend metrics; token counts are chars/4 estimates only.",
    inputSchema: { type: "object", properties: {} }
  }
];

// plugins/foundry/src/mcp/tools/hub.ts
var hubTools = [
  {
    name: "hub_init",
    description: "Initialize the user's local Usora storage in the host plugin data directory, local fallback directory (<cwd>/.usora), or the directory previously chosen via hub_config. Never create sample data. Optionally set maintainer/automation_policy.",
    inputSchema: {
      type: "object",
      properties: {
        maintainer: { type: "string", description: "Optional Primary Maintainer to set during init (e.g. codex)." },
        automation_policy: {
          type: "string",
          enum: AUTOMATION_POLICIES,
          description: "Optional automation policy to set during init."
        }
      }
    }
  },
  {
    name: "hub_status",
    description: "Inspect Usora counts, configuration, and resolved data locations without loading all Activities. Use this as the source of truth when users ask where Practice data, Shared Knowledge, Activity, Session, Pattern, Candidate, or Skill data lives. Returns host-local practice paths, shared knowledge paths, path resolution sources, registered Activity Source locations, counts, and next_action.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hub_query",
    description: "Query a registered host Hub without accepting arbitrary filesystem paths. Use it to inspect another host's Activities, Sessions, Events, Candidates, Skills, or Indexes from the current Usora MCP process. Pass host (codex or codebuddy), collection, optional limit, and optional fields.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", enum: ["codex", "codebuddy"], description: "Registered host to query." },
        collection: {
          type: "string",
          enum: ["activities", "sessions", "events", "candidates", "skills", "indexes"],
          description: "Fixed Hub collection to read."
        },
        limit: { type: "number" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "hub_migrate",
    description: "Explicitly migrate a v1 Hub to the current schema. Defaults to dry run; pass confirm=true to back up and migrate.",
    inputSchema: {
      type: "object",
      properties: {
        dry_run: { type: "boolean" },
        confirm: { type: "boolean", description: "Required true to write migration changes." }
      }
    }
  },
  {
    name: "hub_doctor",
    description: "Run a lightweight local Hub health check for required directories, counts, config, and missing Skill metadata.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hub_cleanup",
    description: "Clean in three modes: generated archives absorbed Activities; blank safely archives empty Activities and rebuilds Patterns without breaking Candidate evidence; all permanently deletes every Usora Hub record, Skill, archive, event, and config and requires confirm=true. It empties the data directory but keeps the Hub directory and config file so the user can review the path.",
    inputSchema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["generated", "blank", "all"] }, confirm: { type: "boolean" } }
    }
  },
  {
    name: "plugin_cache_cleanup",
    description: "Preview or delete old installed Usora plugin cache versions, keeping the currently running plugin version. Defaults to dry run; pass confirm=true to delete.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Required true to delete old installed Usora plugin cache versions. Omit or false for dry run."
        }
      }
    }
  },
  {
    name: "hub_config",
    description: "Configure the Maintainer, automation policy, and/or relocate the data directory. Pass `path` to MOVE the existing Hub data to a new directory (migrates existing records and clears the old directory), applied immediately.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional new data directory (absolute or relative). Existing data is moved there and the old directory cleared."
        },
        maintainer: { type: "string" },
        automation_policy: { type: "string", enum: AUTOMATION_POLICIES }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/skill.ts
var skillTools = [
  {
    name: "skill_create",
    description: "Create a Skill draft with SKILL.md content.",
    inputSchema: {
      type: "object",
      required: ["name", "content"],
      properties: {
        name: { type: "string" },
        content: { type: "string" },
        description: { type: "string" },
        candidate_id: { type: "string" }
      }
    }
  },
  {
    name: "skill_generate",
    description: "Generate a deterministic Skill draft from a passing Candidate without loading full Activities.",
    inputSchema: {
      type: "object",
      required: ["candidate_id"],
      properties: {
        candidate_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" }
      }
    }
  },
  {
    name: "skill_evolve",
    description: "Apply or recommend a SkillDelta. With a passing candidate_id, defaults to PATCH an existing similar Skill before creating a new draft.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        candidate_id: { type: "string" },
        pattern_fingerprint: { type: "string" },
        action: { type: "string", enum: ["CREATE", "PATCH", "NOOP", "SPLIT", "MERGE"] },
        reason: { type: "string" },
        evidence: { type: "array", items: { type: "object" } },
        target_skill: { type: "string" },
        threshold: { type: "number" },
        changes: {
          type: "object",
          properties: {
            content: { type: "string" },
            content_append: { type: "string" },
            description: { type: "string" }
          }
        }
      }
    }
  },
  {
    name: "skill_evaluate",
    description: "Evaluate a Skill draft as pass or fail.",
    inputSchema: {
      type: "object",
      required: ["name", "result"],
      properties: {
        name: { type: "string" },
        result: { type: "string", enum: ["pass", "fail"] },
        reviewer: { type: "string" },
        notes: { type: "string" }
      }
    }
  },
  {
    name: "skill_publish",
    description: "Publish an evaluated Skill as the configured Maintainer by updating the single current Skill in place.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" }, actor: { type: "string" } }
    }
  },
  {
    name: "skill_read",
    description: "Read one Skill's metadata and SKILL.md content by name.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } }
  },
  {
    name: "skill_list",
    description: "Deprecated: use skill_query. List recent Skill metadata without loading SKILL.md content.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "skill_index",
    description: "Query or rebuild the local Skill metadata-only index.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["query", "rebuild"] },
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        candidate_id: { type: "string" },
        since: { type: "string" },
        q: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "skill_query",
    description: "Query Skill metadata from the local index without reading SKILL.md.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        candidate_id: { type: "string" },
        since: { type: "string" },
        q: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "skill_get",
    description: "Read one Skill metadata record plus SKILL.md content by name.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } }
  },
  {
    name: "skill_validate",
    description: "Validate one published Hub Skill as an Agent Skills package without changing the source. Returns structured errors, warnings, files, dependencies and compatibility; does not prove independent execution.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["skill_id"],
      properties: {
        skill_id: { type: "string", description: "Existing Skill directory name, as returned by skill_query." }
      }
    }
  },
  {
    name: "skill_export",
    description: "Export a validated published Skill snapshot as a directory or deterministic ZIP. Never publishes or changes the source. Default conflict policy is error; output_path is an existing absolute parent directory.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["skill_id", "output_path"],
      properties: {
        skill_id: { type: "string", description: "Existing published Skill directory name." },
        format: { type: "string", enum: ["directory", "zip"], default: "directory" },
        output_path: {
          type: "string",
          description: "Existing absolute export parent directory outside Hub/plugin data."
        },
        conflict: { type: "string", enum: ["error", "overwrite"], default: "error" },
        dry_run: {
          type: "boolean",
          default: false,
          description: "Preview validation, files and target without writing."
        }
      }
    }
  },
  {
    name: "usage_capture",
    description: "Record one runtime Skill usage outcome and update Skill usage metrics. Outcome may be unknown.",
    inputSchema: {
      type: "object",
      required: ["skill"],
      properties: {
        session_id: { type: "string" },
        skill: { type: "string" },
        activity_id: { type: "string" },
        outcome: { type: "string", enum: ["success", "partial", "failure", "unknown"] },
        validation_evidence: { type: "array", items: { type: "string" } },
        project: { type: "string" },
        used_at: { type: "string" }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/index.ts
var allToolDefinitions = [...hubTools, ...activityTools, ...candidateTools, ...skillTools, ...governanceTools];

// plugins/foundry/src/mcp/registry.ts
var seen = new Set;
for (const tool of allToolDefinitions) {
  if (seen.has(tool.name))
    throw new Error(`Duplicate MCP tool: ${tool.name}`);
  seen.add(tool.name);
}
for (const name of USORA_TOOL_NAMES) {
  if (!seen.has(name))
    throw new Error(`Missing MCP tool definition: ${name}`);
}
var tools = allToolDefinitions;
var toolRegistry = new Map(tools.map((tool) => [tool.name, tool]));
function listTools() {
  return tools;
}
function getTool(name) {
  return toolRegistry.get(name);
}

// plugins/foundry/src/mcp/handlers.ts
var HANDLERS = {
  hub_init: handleHubInit,
  hub_migrate: handleHubMigrate,
  hub_config: handleHubConfig,
  hub_status: handleHubStatus,
  hub_doctor: handleHubDoctor,
  hub_query: handleHubQuery,
  hub_cleanup: handleHubCleanup,
  plugin_cache_cleanup: handlePluginCacheCleanup,
  context_budget: handleContextBudget,
  governance_scan: handleGovernanceScan,
  governance_resolve: handleGovernanceResolve,
  skill_graph_validate: handleSkillGraphValidate,
  activity_capture: handleActivityCapture,
  activity_digest_list: handleActivityDigestList,
  activity_list: handleActivityList,
  activity_query: handleActivityQuery,
  activity_get: handleActivityGet,
  candidate_create: handleCandidateCreate,
  candidate_match: handleCandidateMatch,
  candidate_query: handleCandidateQuery,
  candidate_get: handleCandidateGet,
  candidate_resolve: handleCandidateResolve,
  pattern_index: handlePatternIndex,
  pattern_query: handlePatternQuery,
  pattern_get: handlePatternGet,
  candidate_list: handleCandidateList,
  candidate_evaluate: handleCandidateEvaluate,
  skill_create: handleSkillCreate,
  skill_generate: handleSkillGenerate,
  skill_evolve: handleSkillEvolve,
  skill_evaluate: handleSkillEvaluate,
  skill_publish: handleSkillPublish,
  skill_read: handleSkillRead,
  skill_list: handleSkillList,
  skill_index: handleSkillIndex,
  skill_query: handleSkillQuery,
  skill_get: handleSkillGet,
  skill_validate: handleSkillValidate,
  skill_export: handleSkillExport,
  usage_capture: handleUsageCapture,
  event_list: handleEventList,
  telemetry_metrics: handleTelemetryMetrics
};
var MIGRATION_ALLOWED = new Set([
  "hub_init",
  "hub_migrate",
  "hub_status",
  "hub_doctor",
  "hub_query",
  "event_list",
  "telemetry_metrics",
  "plugin_cache_cleanup"
]);
var WRITE_TOOLS = new Set([
  "hub_config",
  "hub_cleanup",
  "activity_capture",
  "candidate_create",
  "candidate_resolve",
  "candidate_evaluate",
  "pattern_index",
  "skill_create",
  "skill_generate",
  "skill_evolve",
  "skill_evaluate",
  "skill_publish",
  "context_budget",
  "usage_capture",
  "governance_resolve"
]);
async function call(name, args = {}) {
  const handler = HANDLERS[name];
  if (!handler || !getTool(name))
    throw Error(`Unknown Usora tool: ${name}`);
  if (name === "skill_validate" || name === "skill_export")
    return handler(args);
  await ensure();
  if (WRITE_TOOLS.has(name) && !MIGRATION_ALLOWED.has(name) && (await migrationStatus()).migration_required) {
    throw Error("Hub migration required before writing v2 records. Run hub_migrate with dry_run, then confirm=true.");
  }
  return handler(args);
}

// plugins/foundry/src/mcp/server.ts
var pluginRoot = path23.resolve(path23.dirname(fileURLToPath4(import.meta.url)), "..", "..");
function readServerVersion() {
  try {
    const plugin = JSON.parse(readFileSync(path23.join(pluginRoot, "plugin.json"), "utf8"));
    return typeof plugin.version === "string" ? plugin.version : "2.0.0";
  } catch {
    return "2.0.0";
  }
}
var serverVersion = readServerVersion();
function jsonRpcResult(id, value) {
  return { jsonrpc: "2.0", id, result: value };
}
function toolCallResult(id, value) {
  return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
}
function jsonRpcError(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32000, message } };
}
function write(line) {
  process.stdout.write(`${JSON.stringify(line)}
`);
}
function handleRequest(req) {
  switch (req.method) {
    case "initialize":
      return jsonRpcResult(req.id, {
        protocolVersion: typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "usora", version: serverVersion }
      });
    case "tools/list":
      return jsonRpcResult(req.id, { tools: listTools() });
    default:
      if (req.id !== undefined) {
        return jsonRpcError(req.id, `Unsupported method: ${req.method}`);
      }
      return null;
  }
}
function parseRequest(line) {
  const value = JSON.parse(line);
  if (!value || typeof value !== "object")
    throw new Error("Invalid JSON-RPC request");
  return value;
}
function toolCallParams(params) {
  if (!params || typeof params.name !== "string")
    throw new Error("Invalid tools/call params: name is required");
  const rawArgs = params.arguments;
  if (rawArgs === undefined)
    return { name: params.name, args: {} };
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    throw new Error("Invalid tools/call params: arguments must be an object");
  }
  return { name: params.name, args: rawArgs };
}
var rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
var queue = Promise.resolve();
rl.on("line", (line) => {
  queue = queue.then(async () => {
    let req;
    try {
      req = parseRequest(line);
      let response;
      if (req.method === "tools/call") {
        const { name, args } = toolCallParams(req.params);
        const value = await call(name, args);
        response = toolCallResult(req.id, value);
      } else {
        response = handleRequest(req);
      }
      if (response)
        write(response);
    } catch (err) {
      if (req?.id !== undefined)
        write(jsonRpcError(req.id, err instanceof Error ? err.message : String(err)));
    }
  });
});
