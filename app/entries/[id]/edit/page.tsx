import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateExerciseEntry } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type EditEntryPageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
  }>;
};

type Exercise = {
  id: string;
  name: string;
  exercise_categories: {
    name: string;
  }[];
};

type ExerciseEntry = {
  id: string;
  exercise_id: string;
  quantity: number;
  completed_at: string;
  notes: string;
};

function formatDateForInput(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default async function EditEntryPage({
  params,
  searchParams,
}: EditEntryPageProps) {
  const { id } = await params;
  const { error: pageError } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: entryData, error: entryError },
    { data: exerciseData, error: exerciseError },
  ] = await Promise.all([
    supabase
      .from("exercise_entries")
      .select("id, exercise_id, quantity, completed_at, notes")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),

    supabase
    .from("exercises")
    .select(`
        id,
        name,
        exercise_categories (
        name
        )
    `)
    .eq("is_active", true)
    .order("display_order", { ascending: true }),
  ]);

  if (entryError) {
    throw new Error(`Unable to load entry: ${entryError.message}`);
  }

  if (exerciseError) {
    throw new Error(
      `Unable to load exercises: ${exerciseError.message}`,
    );
  }

  if (!entryData) {
    notFound();
  }

  const entry = entryData as ExerciseEntry;
  const exercises = (exerciseData ?? []) as Exercise[];

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          ← Back to dashboard
        </Link>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Edit activity</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Correct the exercise, quantity, or completion date.
          </p>

          {pageError && (
            <div className="mt-5 rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-200">
              {pageError}
            </div>
          )}

          <form action={updateExerciseEntry} className="mt-6 space-y-5">
            <input type="hidden" name="entry_id" value={entry.id} />

            <div>
              <label
                htmlFor="exercise_id"
                className="block text-sm font-medium text-zinc-300"
              >
                Exercise
              </label>

              <select
                id="exercise_id"
                name="exercise_id"
                required
                defaultValue={entry.exercise_id}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                {exercises.map((exercise) => {
                const categoryName =
                    exercise.exercise_categories[0]?.name;

                return (
                    <option key={exercise.id} value={exercise.id}>
                    {categoryName
                        ? `${categoryName} — ${exercise.name}`
                        : exercise.name}
                    </option>
                );
                })}
              </select>
            </div>

            <div>
              <label
                htmlFor="quantity"
                className="block text-sm font-medium text-zinc-300"
              >
                Quantity
              </label>

              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                required
                defaultValue={entry.quantity}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="completed_date"
                className="block text-sm font-medium text-zinc-300"
              >
                Date
              </label>

              <input
                id="completed_at"
                name="completed_at"
                type="date"
                required
                defaultValue={formatDateForInput(entry.completed_at)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-zinc-300"
              >
                Notes
              </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={entry.notes}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                Save changes
              </button>

              <Link
                href="/"
                className="rounded-lg border border-zinc-700 px-5 py-2.5 font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                Cancel
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}