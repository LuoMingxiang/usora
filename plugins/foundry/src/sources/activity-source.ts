export type ActivitySourceRecord = {
  source: {
    id: string;
    host: string;
  };
  activity: Record<string, unknown>;
};

export interface ActivitySource {
  id: string;
  host: string;
  root(): Promise<string | null>;
  activitiesPath(): Promise<string | null>;
  discover(): Promise<boolean>;
  readActivities(): Promise<ActivitySourceRecord[]>;
}
