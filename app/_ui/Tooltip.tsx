"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./ui.module.css";

type Props = { label: string; children: ReactNode };

export function Tooltip({ label, children }: Props) {
  const id = useId();
  const [show, setShow] = useState(false);

  const handlers = {
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false),
  };

  const tip = (
    <span role="tooltip" id={id} hidden={!show} className={styles.tooltip}>
      {label}
    </span>
  );

  const only = Children.count(children) === 1 ? Children.only(children) : null;
  if (isValidElement(only)) {
    const child = only as ReactElement<{ "aria-describedby"?: string }>;
    const describedBy = [child.props["aria-describedby"], id].filter(Boolean).join(" ");
    return (
      <span className={styles.tooltipWrap} {...handlers}>
        {cloneElement(child, { "aria-describedby": describedBy })}
        {tip}
      </span>
    );
  }

  // Fallback: children isn't a single element — keep the wrapper approach.
  return (
    <span className={styles.tooltipWrap} {...handlers}>
      <span aria-describedby={id}>{children}</span>
      {tip}
    </span>
  );
}
