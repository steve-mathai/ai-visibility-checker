"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { COMMANDS } from "./data";
import { vars } from "./css";
import styles from "./landing.module.css";

/**
 * What the score is made of, set as the product's own command menu.
 * A combobox over a listbox: typing filters, arrow keys and hover move the
 * selection (aria-activedescendant), Enter does nothing destructive.
 */
export function Commands() {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(COMMANDS[0].id);
  const byKeyboard = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) =>
      [c.name, c.text, c.chip].some((s) => s.toLowerCase().includes(q)),
    );
  }, [query]);

  const active = filtered.find((c) => c.id === activeId) ?? filtered[0];
  const optionId = (id: string) => `${listId}-${id}`;

  useEffect(() => {
    if (!byKeyboard.current || !active) return;
    byKeyboard.current = false;
    document
      .getElementById(`${listId}-${active.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  function move(delta: number | "first" | "last") {
    if (filtered.length === 0) return;
    const i = active ? filtered.indexOf(active) : 0;
    const next =
      delta === "first"
        ? 0
        : delta === "last"
          ? filtered.length - 1
          : (i + delta + filtered.length) % filtered.length;
    byKeyboard.current = true;
    setActiveId(filtered[next].id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        if (filtered.length) {
          event.preventDefault();
          move("first");
        }
        break;
      case "End":
        if (filtered.length) {
          event.preventDefault();
          move("last");
        }
        break;
      case "Enter":
        // Nothing to submit; keep the selection where it is.
        event.preventDefault();
        break;
      case "Escape":
        if (query) {
          event.preventDefault();
          setQuery("");
        }
        break;
    }
  }

  return (
    <section
      id="checks"
      aria-labelledby="commands-title"
      data-section
      className={`${styles.frame} ${styles.section}`}
    >
      <div className={styles.cmdLabelWrap}>
        <h2
          id="commands-title"
          className={styles.h2Lead}
          data-reveal
          style={vars({ "--i": 0 })}
        >
          What the score is made of
        </h2>
      </div>

      <div data-ui>
        <div data-reveal style={vars({ "--i": 1 })}>
          <label htmlFor={inputId} className="sr-only">
            Filter the checks
          </label>
          <input
            id={inputId}
            name="filter"
            type="text"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(active.id) : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Find a check…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className={styles.cmdInput}
          />
        </div>

        <ul
          id={listId}
          role="listbox"
          aria-label="Checks"
          className={styles.cmdList}
          data-reveal
          style={vars({ "--i": 2 })}
        >
          {filtered.map((c) => (
            <li
              key={c.id}
              id={optionId(c.id)}
              role="option"
              aria-selected={c.id === active?.id}
              className={styles.cmdRow}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => {
                if (c.id !== active?.id) setActiveId(c.id);
              }}
              onClick={() => setActiveId(c.id)}
            >
              <div className={styles.cmdMain}>
                <span className={styles.cmdName}>{c.name}</span>
                <span className={styles.chip} aria-hidden="true">
                  {c.chip}
                </span>
              </div>
              {/* Only the selected row carries its sentence, so collapsed rows hold just their name. */}
              {c.id === active?.id ? (
                <div className={styles.cmdMore}>
                  <p className={styles.cmdText}>{c.text}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {filtered.length === 0 ? (
          <p className={styles.cmdEmpty} role="status">
            No check matches “{query.trim()}”. Clear the filter to see all 8.
          </p>
        ) : (
          <p className="sr-only" role="status">
            {filtered.length} {filtered.length === 1 ? "check" : "checks"}
          </p>
        )}
      </div>
    </section>
  );
}
