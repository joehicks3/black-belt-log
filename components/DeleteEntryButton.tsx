"use client";

import { deleteExerciseEntry } from "@/app/actions";

type DeleteEntryButtonProps = {
  entryId: string;
};

export default function DeleteEntryButton({
  entryId,
}: DeleteEntryButtonProps) {
  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "Delete this training entry? This cannot be undone.",
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteExerciseEntry} onSubmit={confirmDelete}>
      <input type="hidden" name="entry_id" value={entryId} />

      <button
        type="submit"
        className="rounded-lg border border-red-900 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-950"
      >
        Delete
      </button>
    </form>
  );
}