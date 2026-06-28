export type FollowUpTrigger = {
  leadId: string;
  leadName: string;
  ruleName: string;
  taskTitle: string;
  historyNote: string;
};

export type FollowUpFailure = {
  leadId: string;
  leadName: string;
  ruleName: string;
  error: string;
};

export type FollowUpReport = {
  processedAt: string;
  leadsEvaluated: number;
  triggered: number;
  actionsApplied: number;
  failures: number;
  triggers: FollowUpTrigger[];
  failureDetails: FollowUpFailure[];
};
