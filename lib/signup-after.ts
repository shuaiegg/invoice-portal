type PostSignupTasks = {
  assignFirstAdmin(): Promise<void>;
  claimWorker(): Promise<unknown>;
  reportClaimError(error: unknown): void;
};

export async function runPostSignupTasks(tasks: PostSignupTasks): Promise<void> {
  await tasks.assignFirstAdmin();
  try {
    await tasks.claimWorker();
  } catch (error) {
    tasks.reportClaimError(error);
  }
}
