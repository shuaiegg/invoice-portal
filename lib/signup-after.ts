type PostSignupTasks = {
  claimWorker(): Promise<unknown>;
  reportClaimError(error: unknown): void;
};

export async function runPostSignupTasks(tasks: PostSignupTasks): Promise<void> {
  try {
    await tasks.claimWorker();
  } catch (error) {
    tasks.reportClaimError(error);
  }
}
