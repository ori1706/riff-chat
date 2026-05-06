import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { User } from "../types";

function injectMentionLinks(text: string, users: User[]): string {
  let out = text;
  const sorted = [...users].sort((a, b) => b.name.length - a.name.length);
  for (const u of sorted) {
    const safe = u.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@${safe}(?=\\b|[.,!?])`, "g");
    out = out.replace(re, `[@${u.name}](mention:${encodeURIComponent(u.name)})`);
  }
  // linkify bare @everyone style tokens as subtle chips
  out = out.replace(/@everyone\b/g, "[@everyone](mention:everyone)");
  return out;
}

export function MarkdownBody({ text, users }: { text: string; users: User[] }) {
  const src = injectMentionLinks(text, users);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a({ href, children }) {
          if (href?.startsWith("mention:")) {
            return (
              <span className="rounded bg-slackord-teal/15 px-1 font-semibold text-slackord-teal">
                @{decodeURIComponent(href.slice("mention:".length))}
              </span>
            );
          }
          return (
            <a
              href={href}
              className="text-slackord-teal underline decoration-slackord-teal/40 underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          );
        },
        code({ inline, className, children, ...rest }: { inline?: boolean; className?: string; children?: ReactNode }) {
          const match = /language-(\w+)/.exec(className || "");
          if (inline || !match) {
            return (
              <code
                className="rounded bg-slackord-border/80 px-1.5 py-0.5 font-mono text-[0.9em] text-slackord-text"
                {...rest}
              >
                {children}
              </code>
            );
          }
          const lang = match[1] ?? "text";
          return (
            <SyntaxHighlighter
              language={lang}
              style={oneDark}
              PreTag="div"
              customStyle={{
                margin: "8px 0",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          );
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 text-sm">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 text-sm">{children}</ol>;
        },
        p({ children }) {
          return <p className="mb-1 text-[15px] leading-relaxed last:mb-0">{children}</p>;
        },
        strong({ children }) {
          return <strong className="font-semibold text-white">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-slackord-muted">{children}</em>;
        },
      }}
    >
      {src}
    </ReactMarkdown>
  );
}
