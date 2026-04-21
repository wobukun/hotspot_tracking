class TaskManager {
  private tasks: Map<string, { aborted: boolean; createdAt: Date }> = new Map();

  /**
   * 创建一个新任务
   */
  createTask(): string {
    const taskId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    this.tasks.set(taskId, { aborted: false, createdAt: new Date() });
    console.log(`✅ 任务 ${taskId} 已创建`);
    return taskId;
  }

  /**
   * 检查任务是否已被取消
   */
  isTaskAborted(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    return task?.aborted ?? true;
  }

  /**
   * 取消一个任务
   */
  abortTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.aborted = true;
      console.log(`⏹️ 任务 ${taskId} 已取消`);
      return true;
    }
    return false;
  }

  /**
   * 清理已完成的任务
   */
  cleanupTask(taskId: string): void {
    this.tasks.delete(taskId);
    console.log(`🧹 任务 ${taskId} 已清理`);
  }
}

export default new TaskManager();
