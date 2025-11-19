/**
 * AutocompleteInput Component
 * Text input with dropdown suggestions as you type
 */

import { createSignal, Show, onCleanup, For, createEffect } from "solid-js";

interface AutocompleteInputProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  suggestions: string[];
  required?: boolean;
}

export function AutocompleteInput(props: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [filteredSuggestions, setFilteredSuggestions] = createSignal<string[]>(
    []
  );
  const [highlightedIndex, setHighlightedIndex] = createSignal(-1);

  let inputRef: HTMLInputElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;

  // Update filtered suggestions when props change or input changes
  createEffect(() => {
    const value = props.value;
    const suggestions = props.suggestions;

    console.log(`[AutocompleteInput:${props.label}] Effect triggered:`, {
      value,
      suggestionsCount: suggestions.length,
      isOpen: isOpen(),
    });

    if (value.trim().length > 0 && suggestions.length > 0) {
      const filtered = suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 20);

      console.log(
        `[AutocompleteInput:${props.label}] Filtered results:`,
        filtered.length
      );

      setFilteredSuggestions(filtered);

      if (filtered.length > 0 && isOpen()) {
        setHighlightedIndex(-1);
      }
    } else if (value.trim().length === 0) {
      setFilteredSuggestions([]);
      setIsOpen(false);
    }
  });

  const handleInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    console.log(`[AutocompleteInput:${props.label}] Input changed to:`, value);

    props.onInput(value);

    if (value.trim().length > 0) {
      console.log(`[AutocompleteInput:${props.label}] Opening dropdown`);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    if (props.value.trim().length > 0 && filteredSuggestions().length > 0) {
      setIsOpen(true);
    }
  };

  const handleSelect = (suggestion: string) => {
    props.onInput(suggestion);
    setIsOpen(false);
    setFilteredSuggestions([]);
    inputRef?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen()) return;

    const suggestions = filteredSuggestions();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex() >= 0 && suggestions[highlightedIndex()]) {
          handleSelect(suggestions[highlightedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Click outside to close
  const handleClickOutside = (e: MouseEvent) => {
    if (
      dropdownRef &&
      inputRef &&
      !dropdownRef.contains(e.target as Node) &&
      !inputRef.contains(e.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  onCleanup(() =>
    document.removeEventListener("mousedown", handleClickOutside)
  );

  return (
    <div class="relative">
      <label class="block text-sm font-medium text-primary/80 mb-2">
        {props.label} {props.required && "*"}
      </label>
      <input
        ref={inputRef}
        type="text"
        value={props.value}
        onInput={handleInput}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder}
        autocomplete="off"
        class="w-full px-4 py-2 bg-background border border-primary/20 rounded text-primary placeholder-primary/40 focus:outline-none focus:border-blue-400"
      />

      <Show when={isOpen() && filteredSuggestions().length > 0}>
        <div
          ref={dropdownRef}
          class="absolute z-50 w-full mt-1 bg-background border border-primary/20 rounded shadow-lg max-h-60 overflow-y-auto"
        >
          <For each={filteredSuggestions()}>
            {(suggestion, index) => (
              <button
                type="button"
                onClick={() => handleSelect(suggestion)}
                onMouseDown={(e) => e.preventDefault()}
                class={`w-full px-4 py-2 text-left text-sm hover:bg-primary/10 transition-colors ${
                  index() === highlightedIndex() ? "bg-blue-500/20" : ""
                }`}
              >
                <span class="text-primary">{suggestion}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
