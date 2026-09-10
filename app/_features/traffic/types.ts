// Moved out of sample-traffic.ts (plan 04 deletes the fabrication function
// that lived there) so the real UI components — TrafficTable, TrafficRow,
// TrafficDrawer, TrafficView — keep a stable type to render, independent of
// where the rows come from. Plan 05 wires these to real traffic and may
// reshape this to match the backend TrafficEntry (src/store/types.ts) more
// closely; until then this is exactly the shape those components already
// expect.
export interface TrafficEntry {
  id: string;
  method: string;
  endpointKey: string;
  path: string;
  status: number;
  at: string;
  ms: number;
  reqHeaders: Record<string, string>;
  reqBody: string;
  resBody: string;
}
