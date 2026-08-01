import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  eventNameForQualification,
  eventNameForStatus,
  sendLeadCrmEvent,
  STATUS_EVENT_MAP,
  QUALIFICATION_EVENT_MAP,
} from '@/lib/meta-capi';

describe('eventNameForStatus', () => {
  it('maps CLOSED_WON to the strongest positive event', () => {
    expect(eventNameForStatus('CLOSED_WON')).toBe('Converted');
  });

  it('returns null for statuses we do not report (qualification now drives Qualified/Disqualified)', () => {
    expect(eventNameForStatus('NEW')).toBeNull();
    expect(eventNameForStatus('FOLLOW_UP')).toBeNull();
    expect(eventNameForStatus('MEETING_FIXED')).toBeNull();
    expect(eventNameForStatus('JUNK')).toBeNull();
    expect(eventNameForStatus('CLOSED_LOST')).toBeNull();
    expect(eventNameForStatus(null)).toBeNull();
    expect(eventNameForStatus(undefined)).toBeNull();
  });
});

describe('eventNameForQualification', () => {
  it('maps QUALIFIED/NOT_QUALIFIED to positive/negative events', () => {
    expect(eventNameForQualification('QUALIFIED')).toBe('Qualified');
    expect(eventNameForQualification('NOT_QUALIFIED')).toBe('Disqualified');
  });

  it('returns null for UNREVIEWED / unset', () => {
    expect(eventNameForQualification('UNREVIEWED')).toBeNull();
    expect(eventNameForQualification(null)).toBeNull();
    expect(eventNameForQualification(undefined)).toBeNull();
  });
});

describe('sendLeadCrmEvent', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubEnv('META_DATASET_ID', '999000111');
    vi.stubEnv('META_CAPI_ACCESS_TOKEN', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('skips (no fetch) when there is no event to report', async () => {
    const sent = await sendLeadCrmEvent({ leadgenId: '123', eventName: null });
    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips when there is no leadgenId (manual / non-Meta lead)', async () => {
    expect(await sendLeadCrmEvent({ leadgenId: null, eventName: 'Disqualified' })).toBe(false);
    expect(await sendLeadCrmEvent({ leadgenId: 'abc', eventName: 'Disqualified' })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips (no fetch) when META_DATASET_ID is not configured', async () => {
    vi.stubEnv('META_DATASET_ID', '');
    const sent = await sendLeadCrmEvent({ leadgenId: '123', eventName: 'Disqualified' });
    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a correct CRM event payload for a qualified lead', async () => {
    const sent = await sendLeadCrmEvent({
      leadgenId: '1234567890',
      eventName: eventNameForQualification('QUALIFIED'),
      at: 1_700_000_000_000,
    });
    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/999000111/events');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');

    const event = JSON.parse(init.body as string).data[0];
    expect(event.event_name).toBe('Qualified');
    expect(event.action_source).toBe('system_generated');
    expect(event.event_time).toBe(1_700_000_000); // ms → seconds
    expect(event.user_data.lead_id).toBe(1234567890); // unquoted number, not a string
    expect(event.custom_data.event_source).toBe('crm');
  });

  it('preserves full precision of large lead IDs (no JS number rounding)', async () => {
    const bigId = '99999999999999999'; // exceeds Number.MAX_SAFE_INTEGER
    await sendLeadCrmEvent({ leadgenId: bigId, eventName: 'Disqualified' });
    const rawBody = fetchMock.mock.calls[0][1].body as string;
    expect(rawBody).toContain(`"lead_id":${bigId}`);
  });

  it('returns false (does not throw) when Meta responds with an error', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: { message: 'bad token' } }) });
    expect(await sendLeadCrmEvent({ leadgenId: '123', eventName: 'Disqualified' })).toBe(false);
  });

  it('returns false (does not throw) when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(sendLeadCrmEvent({ leadgenId: '123', eventName: 'Disqualified' })).resolves.toBe(false);
  });

  it('exposes a status→event map with only the Converted signal', () => {
    expect(Object.values(STATUS_EVENT_MAP)).toEqual(['Converted']);
  });

  it('exposes a qualification→event map that covers both signals', () => {
    const events = Object.values(QUALIFICATION_EVENT_MAP);
    expect(events).toContain('Qualified');
    expect(events).toContain('Disqualified');
  });
});
