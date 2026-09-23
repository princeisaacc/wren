import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

import type { PendingAction, Step } from "@/lib/agent-types";
import type { ServiceKey } from "@/lib/services";

export type EmailItem = {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  date?: string;
  snippet?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  steps?: Step[];
  actions?: PendingAction[];
  connect?: ServiceKey;
  link?: string;
  linkLabel?: string;
  emails?: EmailItem[]; // structured email list for card rendering
};
export type MessageExtras = Partial<Pick<ChatMessage, "steps" | "actions" | "connect" | "link" | "linkLabel" | "emails">>;
export type Conversation = { id: string; title: string; preview: string; updatedAt: number };

const conversations = (uid: string) => collection(getDb(), "users", uid, "conversations");
const messagesOf = (uid: string, cid: string) =>
  collection(getDb(), "users", uid, "conversations", cid, "messages");

export function newConversationId(uid: string) {
  return doc(conversations(uid)).id;
}

export async function createConversation(uid: string, id: string, firstText: string) {
  const now = Date.now();
  const text = firstText.trim();
  await setDoc(doc(conversations(uid), id), {
    title: text.slice(0, 60),
    preview: text.slice(0, 140),
    createdAt: now,
    updatedAt: now,
  });
}

export async function addMessage(
  uid: string,
  cid: string,
  role: ChatMessage["role"],
  text: string,
  extras?: MessageExtras,
) {
  const ts = Date.now();
  const clean = extras ? JSON.parse(JSON.stringify(extras)) : {};
  await addDoc(messagesOf(uid, cid), { role, text, ts, ...clean });
  await updateDoc(doc(conversations(uid), cid), { preview: text.slice(0, 140), updatedAt: ts });
}

export function subscribeMessages(
  uid: string,
  cid: string,
  onData: (items: ChatMessage[]) => void,
  onError: () => void,
) {
  return onSnapshot(
    query(messagesOf(uid, cid), orderBy("ts")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }))),
    onError,
  );
}

export function subscribeConversations(
  uid: string,
  onData: (items: Conversation[]) => void,
  onError: () => void,
) {
  return onSnapshot(
    query(conversations(uid), orderBy("updatedAt", "desc")),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Conversation, "id">) }))),
    onError,
  );
}

export async function deleteConversation(uid: string, cid: string) {
  const snap = await getDocs(messagesOf(uid, cid));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(getDb());
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(conversations(uid), cid));
}

export async function patchMessage(uid: string, cid: string, mid: string, data: MessageExtras) {
  await updateDoc(doc(messagesOf(uid, cid), mid), JSON.parse(JSON.stringify(data)));
}