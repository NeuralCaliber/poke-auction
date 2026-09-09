import { CHAT_MAX_LENGTH, type ChatMessage, type PublicState } from "@poke-auction/shared";
import { FormEvent, useEffect, useRef, useState } from "react";

export function ChatPanel({
  state,
  playerId,
  pending,
  onSend,
}: {
  state: PublicState;
  playerId: string;
  pending: boolean;
  onSend: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [state.chat.length, open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <section className="border-line bg-panel flex flex-col overflow-hidden rounded-3xl border">
      <button
        type="button"
        className="flex min-h-12 items-center justify-between px-4 py-3 text-left md:hidden"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="font-display text-sm tracking-wide uppercase">Chat</span>
        <span className="text-muted text-sm">{open ? "Hide" : "Show"}</span>
      </button>
      <div className={`${open ? "flex" : "hidden"} md:flex min-h-0 flex-1 flex-col`}>
        <div ref={scroller} className="flex max-h-56 flex-col gap-2 overflow-y-auto px-4 py-3 md:max-h-72">
          {state.chat.length === 0 && (
            <p className="text-muted text-sm">No messages yet. Say hello.</p>
          )}
          {state.chat.map((message) => (
            <ChatLine key={message.id} message={message} selfId={playerId} />
          ))}
        </div>
        <form className="border-line flex gap-2 border-t p-3" onSubmit={handleSubmit}>
          <input
            value={text}
            maxLength={CHAT_MAX_LENGTH}
            onChange={(event) => setText(event.target.value)}
            className="border-line bg-panel-2 min-h-11 flex-1 rounded-xl border px-3 outline-none focus:border-gold"
            placeholder="Message the room"
            aria-label="Chat message"
          />
          <button
            type="submit"
            disabled={pending || text.trim().length < 1}
            className="bg-gold text-ink min-h-11 rounded-xl px-4 font-semibold disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function ChatLine({ message, selfId }: { message: ChatMessage; selfId: string }) {
  if (message.kind === "system") {
    return <p className="text-muted text-center text-xs italic">{message.text}</p>;
  }
  const mine = message.playerId === selfId;
  return (
    <p className={`text-sm ${mine ? "text-gold" : "text-paper"}`}>
      <span className="font-semibold">{message.name}: </span>
      {message.text}
    </p>
  );
}
