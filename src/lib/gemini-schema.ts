type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

export function deref(schema: Json, root: Json = schema, depth = 0): Json {
  if (depth > 8) return {};
  const ref = schema["$ref"];
  if (typeof ref === "string" && ref.startsWith("#/")) {
    const target = ref
      .slice(2)
      .split("/")
      .reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), root);
    const { $ref: _ignored, ...rest } = schema;
    void _ignored;
    return isObj(target) ? deref({ ...target, ...rest }, root, depth + 1) : {};
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "$defs" || k === "definitions") continue;
    if (Array.isArray(v)) out[k] = v.map((x) => (isObj(x) ? deref(x, root, depth + 1) : x));
    else if (isObj(v)) out[k] = deref(v, root, depth + 1);
    else out[k] = v;
  }
  return out;
}

const TYPES = new Set(["string", "number", "integer", "boolean", "array", "object"]);

export function toGeminiSchema(input: unknown, depth = 0): Json {
  if (!isObj(input) || depth > 8) return { type: "string" };
  let s: Json = input;

  for (const key of ["anyOf", "oneOf"]) {
    const list = s[key];
    if (Array.isArray(list)) {
      const options = list.filter((o): o is Json => isObj(o) && o.type !== "null");
      const nullable = list.some((o) => isObj(o) && o.type === "null");
      const { [key]: _drop, ...rest } = s;
      void _drop;
      s = { ...rest, ...(options[0] ?? {}), ...(nullable ? { nullable: true } : {}) };
      if (rest.description) s.description = rest.description;
    }
  }
  if (Array.isArray(s.allOf) && isObj(s.allOf[0])) {
    const { allOf: _a, ...rest } = s;
    void _a;
    s = { ...rest, ...(s.allOf[0] as Json) };
  }

  let type: unknown = s.type;
  let nullable = s.nullable === true;
  if (Array.isArray(type)) {
    nullable = type.includes("null");
    type = type.find((t) => t !== "null");
  }
  if (!type) type = s.properties ? "object" : s.items ? "array" : "string";
  if (typeof type !== "string" || !TYPES.has(type)) type = "string";

  const out: Json = { type };
  if (typeof s.description === "string") out.description = s.description.slice(0, 200);
  if (nullable) out.nullable = true;
  if (Array.isArray(s.enum) && type === "string") out.enum = s.enum.map(String);

  if (type === "object") {
    const entries = isObj(s.properties) ? Object.entries(s.properties) : [];
    if (!entries.length) return { type: "string", description: `${out.description ?? ""} (JSON text)`.trim() };
    const props = Object.fromEntries(entries.map(([k, v]) => [k, toGeminiSchema(v, depth + 1)]));
    out.properties = props;
    if (Array.isArray(s.required)) {
      const req = s.required.filter((k): k is string => typeof k === "string" && k in props);
      if (req.length) out.required = req;
    }
  }
  if (type === "array") out.items = toGeminiSchema(s.items ?? { type: "string" }, depth + 1);
  return out;
}

export function toGeminiParameters(raw: unknown): Json | undefined {
  if (!isObj(raw)) return undefined;
  const flat = deref(raw);
  if (!isObj(flat.properties) || !Object.keys(flat.properties).length) return undefined;
  return toGeminiSchema({ ...flat, type: "object" });
}

// Fields a request usually cannot work without. These are never dropped, even when they are optional.
const KEEP = /recipient|^to$|thread|message|subject|body|query|max_results|time|date|title|summary|start|end|due|tasklist|notes|description|location|attendee|^name$|text|content|^q$/i;

// Keeps a tool definition under a size budget. Required and important fields are always kept, the rest are dropped from the end.
export function pruneParameters(params: Json | undefined, maxChars = 1500): Json | undefined {
  if (!params || !isObj(params.properties)) return params;
  const props = params.properties as Json;
  const required = Array.isArray(params.required) ? (params.required as string[]) : [];
  const keys = Object.keys(props);
  const must = (k: string) => required.includes(k) || KEEP.test(k);
  const order = [...keys.filter((k) => required.includes(k)), ...keys.filter((k) => !required.includes(k) && KEEP.test(k)), ...keys.filter((k) => !must(k))];
  const kept: Json = {};
  for (const k of order) {
    kept[k] = props[k];
    if (!must(k) && JSON.stringify({ ...params, properties: kept }).length > maxChars) delete kept[k];
  }
  return { ...params, properties: kept };
}