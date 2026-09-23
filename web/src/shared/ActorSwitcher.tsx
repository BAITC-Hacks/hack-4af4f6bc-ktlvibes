import type { DemoActor } from "./types";

interface ActorSwitcherProps {
  actors: DemoActor[];
  value: DemoActor | null;
  onChange: (actor: DemoActor) => void;
  disabled?: boolean;
}

function actorKey(actor: DemoActor) {
  return `${actor.role}:${actor.id}`;
}

export function ActorSwitcher({ actors, value, onChange, disabled }: ActorSwitcherProps) {
  return (
    <label className="actor-switcher">
      <span>Демо-профиль</span>
      <select
        aria-label="Демо-профиль"
        disabled={disabled || actors.length === 0}
        value={value ? actorKey(value) : ""}
        onChange={(event) => {
          const actor = actors.find((item) => actorKey(item) === event.target.value);
          if (actor) onChange(actor);
        }}
      >
        {!value && <option value="">{disabled ? "Загрузка профилей…" : "Нет профилей"}</option>}
        {actors.map((actor) => (
          <option key={actorKey(actor)} value={actorKey(actor)}>
            {actor.role === "business" ? "Бизнес" : "Команда"}: {actor.name}
          </option>
        ))}
      </select>
    </label>
  );
}
