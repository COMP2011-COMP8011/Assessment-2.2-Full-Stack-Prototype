import { Fragment, useMemo } from 'react';
import { parseMarkdown } from '../logic/markdown.js';

// Renders the safe Markdown subset from logic/markdown.js as React elements (never raw HTML).
function Inline({ tokens }) {
  return tokens.map((t, i) => {
    switch (t.type) {
      case 'code':
        return <code key={i}>{t.text}</code>;
      case 'strong':
        return <strong key={i}><Inline tokens={t.children} /></strong>;
      case 'em':
        return <em key={i}><Inline tokens={t.children} /></em>;
      case 'link':
        return (
          <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">
            <Inline tokens={t.children} />
          </a>
        );
      default:
        return <Fragment key={i}>{t.text}</Fragment>;
    }
  });
}

export default function Markdown({ text, className }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  if (blocks.length === 0) return null;
  return (
    <div className={`md ${className || ''}`}>
      {blocks.map((block, i) =>
        block.type === 'ul' ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}><Inline tokens={item} /></li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline tokens={line} />
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
