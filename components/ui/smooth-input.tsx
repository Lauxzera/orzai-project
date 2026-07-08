"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export const SmoothInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, value, onChange, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const [caretOffset, setCaretOffset] = useState(0);
    const [caretWidth, setCaretWidth] = useState(2);
    const [isFocused, setIsFocused] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const updateCaret = () => {
      if (!inputRef.current || !measureRef.current) return;
      const input = inputRef.current;
      const measure = measureRef.current;
      
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const val = input.value || "";

      const computed = window.getComputedStyle(input);
      measure.style.fontFamily = computed.fontFamily;
      measure.style.fontSize = computed.fontSize;
      measure.style.fontWeight = computed.fontWeight;
      measure.style.letterSpacing = computed.letterSpacing;
      measure.style.textTransform = computed.textTransform;
      
      measure.textContent = val.substring(0, start).replace(/\s/g, "\u00a0");
      const offset = measure.getBoundingClientRect().width;
      
      if (start === end) {
        setCaretWidth(2);
      } else {
        measure.textContent = val.substring(start, end).replace(/\s/g, "\u00a0");
        setCaretWidth(measure.getBoundingClientRect().width);
      }
      setCaretOffset(offset);
    };

    useEffect(() => {
      if (isFocused) {
        updateCaret();
      }
    }, [value, isFocused]);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 500);
      
      if (onChange) onChange(e);
      updateCaret();
    };

    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <Input
          {...props}
          ref={(node) => {
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
            inputRef.current = node;
          }}
          value={value}
          onChange={handleInput}
          onSelect={updateCaret}
          onKeyUp={updateCaret}
          onClick={updateCaret}
          onFocus={(e) => {
            setIsFocused(true);
            updateCaret();
            if (props.onFocus) props.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (props.onBlur) props.onBlur(e);
          }}
          className="caret-transparent relative z-10 bg-transparent"
        />
        
        <span 
          ref={measureRef}
          className="absolute opacity-0 pointer-events-none whitespace-pre"
          aria-hidden="true"
        />

        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: caretWidth > 2 ? 0.3 : (isTyping ? 1 : [1, 0, 1]), 
                scale: 1,
                x: caretOffset,
                width: caretWidth
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                opacity: { 
                  duration: isTyping ? 0 : 1,
                  repeat: (!isTyping && caretWidth <= 2) ? Infinity : 0,
                  ease: "easeInOut"
                },
                x: { type: "spring", stiffness: 500, damping: 30, mass: 0.5 },
                width: { type: "spring", stiffness: 500, damping: 30, mass: 0.5 }
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 bg-primary pointer-events-none z-0 rounded-[1px]"
              style={{ originY: 0.5 }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
);
SmoothInput.displayName = "SmoothInput";
