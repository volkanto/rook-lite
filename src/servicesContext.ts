import { NoteService, FolderService } from "./services";
import { SummaryService } from "./summaries";

export const notes = new NoteService();
export const folders = new FolderService();
export const summaries = new SummaryService();
