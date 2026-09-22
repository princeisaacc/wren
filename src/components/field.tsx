import { useId } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
};

export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const describedBy = error || hint ? noteId : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {(error || hint) && (
        <p id={noteId} className={`mt-1.5 text-sm ${error ? "text-danger" : "text-sub"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
