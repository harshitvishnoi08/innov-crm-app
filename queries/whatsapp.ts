import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type WhatsAppMessage = {
  id: string;
  leadId: string;
  wamid: string | null;
  fromNumber: string;
  toNumber: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  messageBody: string | null;
  templateName: string | null;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  sentBy: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
};

async function fetchMessages(leadId: string): Promise<WhatsAppMessage[]> {
  const res = await fetch(`/api/whatsapp/${leadId}`);
  const data = await res.json() as { success: boolean; data: WhatsAppMessage[] };
  if (!res.ok) throw new Error('Failed to fetch messages');
  return data.data;
}

async function sendMessage(leadId: string, message: string): Promise<WhatsAppMessage> {
  const res = await fetch(`/api/whatsapp/${leadId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = await res.json() as { success: boolean; data: WhatsAppMessage; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Failed to send message');
  return data.data;
}

export const waQueryKeys = {
  messages: (leadId: string) => ['whatsapp', 'messages', leadId],
};

export function useWhatsAppMessages(leadId: string) {
  return useQuery({
    queryKey: waQueryKeys.messages(leadId),
    queryFn: () => fetchMessages(leadId),
    enabled: !!leadId,
    refetchInterval: 10_000,          // poll every 10s for new inbound messages
    refetchIntervalInBackground: false, // stop polling when tab is not active
    staleTime: 5_000,
  });
}

export function useSendWhatsAppMessage(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => sendMessage(leadId, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: waQueryKeys.messages(leadId) });
    },
  });
}
