'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWhatsAppMessages, useSendWhatsAppMessage, WhatsAppMessage } from '@/queries/whatsapp';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, AlertCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

function formatTime(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateHeader(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusTick({ status }: { status: string }) {
  if (status === 'failed') {
    return <span className="text-destructive text-xs ml-1">✗</span>;
  }
  if (status === 'read') {
    return <span className="text-blue-400 text-xs ml-1 font-bold">✓✓</span>;
  }
  if (status === 'delivered') {
    return <span className="text-muted-foreground text-xs ml-1">✓✓</span>;
  }
  return <span className="text-muted-foreground/60 text-xs ml-1">✓</span>;
}

function groupByDate(messages: WhatsAppMessage[]) {
  const groups: { date: string; messages: WhatsAppMessage[] }[] = [];
  for (const msg of messages) {
    const header = formatDateHeader(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === header) {
      last.messages.push(msg);
    } else {
      groups.push({ date: header, messages: [msg] });
    }
  }
  return groups;
}

interface WhatsAppChatProps {
  leadId: string;
  contactNumber: string | null;
  customerName: string;
}

export function WhatsAppChat({ leadId, contactNumber, customerName }: WhatsAppChatProps) {
  const { data: messages = [], isLoading, isError } = useWhatsAppMessages(leadId);
  const sendMessage = useSendWhatsAppMessage(leadId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length !== prevCountRef.current) {
      prevCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [isLoading, messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;
    setInput('');
    try {
      await sendMessage.mutateAsync(text);
    } catch (err) {
      setInput(text); // restore on failure
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!contactNumber) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-4">
        <Phone className="h-8 w-8 opacity-30" />
        <p className="text-sm text-center">No contact number for this lead.<br />Add a phone number to enable WhatsApp chat.</p>
      </div>
    );
  }

  const groups = groupByDate(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <WhatsAppIcon className="h-4 w-4 text-green-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{customerName}</p>
          <p className="text-xs text-muted-foreground">{contactNumber}</p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full shrink-0">
          {messages.length} msgs
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">Loading messages...</p>
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center h-full gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-xs">Failed to load messages</p>
          </div>
        )}

        {!isLoading && !isError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <WhatsAppIcon className="h-8 w-8 opacity-20" />
            <p className="text-xs text-center">No messages yet.<br />Send the first message to {customerName}.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date}>
            {/* Date header */}
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                {group.date}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {group.messages.map((msg) => {
              const isOut = msg.direction === 'outbound';
              const hasError = msg.status === 'failed';

              return (
                <div
                  key={msg.id}
                  className={`flex mb-1.5 ${isOut ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isOut ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`
                        px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                        ${isOut
                          ? 'bg-green-600 text-white rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                        }
                        ${hasError ? 'opacity-70 border border-destructive/40' : ''}
                      `}
                    >
                      {msg.templateName && (
                        <p className={`text-[10px] mb-1 ${isOut ? 'text-green-200' : 'text-muted-foreground'}`}>
                          Template: {msg.templateName}
                        </p>
                      )}
                      {msg.messageBody || <span className="italic opacity-60">[{msg.messageType}]</span>}
                    </div>
                    <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOut ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(msg.sentAt ?? msg.createdAt)}
                      </span>
                      {isOut && <StatusTick status={msg.status} />}
                      {hasError && msg.failureReason && (
                        <span className="text-[10px] text-destructive">· {msg.failureReason}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t flex gap-2 items-end flex-shrink-0">
        <Textarea
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          className="flex-1 min-h-[36px] max-h-[120px] resize-none text-sm py-2"
        />
        <Button
          size="sm"
          onClick={() => void handleSend()}
          disabled={!input.trim() || sendMessage.isPending}
          className="bg-green-600 hover:bg-green-700 text-white shrink-0 h-9 w-9 p-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
