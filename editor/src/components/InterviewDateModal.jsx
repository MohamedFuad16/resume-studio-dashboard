import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * InterviewDateModal — a small, accessible, fully self-contained modal for
 * capturing an interview date (and optional time) when an application's status
 * is set to "Interview".
 *
 * SELF-CONTAINED: all styling is inline (`style={{...}}`) so this component has
 * NO dependency on `index.css`.
 *
 * Behavior:
 *  - Renders nothing when `open` is falsy.
 *  - Confirm calls `onConfirm(dateString)` where `dateString` is `YYYY-MM-DD`
 *    (or `YYYY-MM-DD HH:MM` when a time is provided).
 *  - Cancel button, backdrop click, and the Escape key all call `onCancel`.
 *  - Focuses the date input when opened; Confirm is disabled until a date is set.
 *
 * @param {object} props
 * @param {boolean} props.open — whether the modal is visible.
 * @param {string} [props.applicationLabel] — label of the application being scheduled.
 * @param {string} [props.initialDate] — pre-fill value (`YYYY-MM-DD` or `YYYY-MM-DD HH:MM`).
 * @param {boolean} [props.isJa] — render Japanese copy when true.
 * @param {(dateString: string) => void} props.onConfirm — receives the chosen date(+time).
 * @param {() => void} props.onCancel — called on cancel / backdrop / Escape.
 */
const MODAL_COPY = {
  en: {
    title: 'Add interview date',
    forLabel: 'For',
    date: 'Interview date',
    time: 'Time (optional)',
    cancel: 'Cancel',
    confirm: 'Confirm',
  },
  ja: {
    title: '面接日を追加',
    forLabel: '対象',
    date: '面接日',
    time: '時刻（任意）',
    cancel: 'キャンセル',
    confirm: '確定',
  },
};

function InterviewDateModal({ open, applicationLabel, initialDate, isJa, onConfirm, onCancel }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const dateRef = useRef(null);
  const titleId = useId();
  const labelId = useId();
  const t = isJa ? MODAL_COPY.ja : MODAL_COPY.en;

  // Sync local state from `initialDate` and move focus to the date field on open.
  useEffect(() => {
    if (!open) return undefined;
    const [initDate = '', initTime = ''] = String(initialDate || '').trim().split(/[ T]/);
    setDate(initDate);
    setTime(initTime);
    const id = window.setTimeout(() => {
      dateRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, initialDate]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!date) return;
    const value = time ? `${date} ${time}` : date;
    onConfirm?.(value);
  };

  const onBackdropClick = event => {
    if (event.target === event.currentTarget) onCancel?.();
  };

  const styles = {
    backdrop: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      zIndex: 1000,
    },
    card: {
      width: '100%',
      maxWidth: '420px',
      background: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
      padding: '24px',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      color: '#0f172a',
    },
    title: {
      margin: '0 0 4px',
      fontSize: '18px',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    label: {
      margin: '0 0 18px',
      fontSize: '14px',
      color: '#475569',
      wordBreak: 'break-word',
    },
    labelStrong: {
      color: '#0f172a',
      fontWeight: 600,
    },
    field: {
      display: 'block',
      marginBottom: '14px',
    },
    fieldLabel: {
      display: 'block',
      marginBottom: '6px',
      fontSize: '13px',
      fontWeight: 600,
      color: '#334155',
    },
    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '10px 12px',
      fontSize: '15px',
      color: '#0f172a',
      border: '1px solid #cbd5e1',
      borderRadius: '10px',
      background: '#f8fafc',
      fontFamily: 'inherit',
    },
    actions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px',
    },
    cancelBtn: {
      appearance: 'none',
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      color: '#334155',
      padding: '10px 16px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
    },
    confirmBtn: {
      appearance: 'none',
      border: '1px solid transparent',
      background: date ? '#0a57ff' : '#93b4ff',
      color: '#ffffff',
      padding: '10px 18px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: date ? 'pointer' : 'not-allowed',
    },
  };

  return (
    <div
      style={styles.backdrop}
      onMouseDown={onBackdropClick}
      role="presentation"
    >
      <div
        style={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={applicationLabel ? labelId : undefined}
        onMouseDown={event => event.stopPropagation()}
      >
        <h2 id={titleId} style={styles.title}>{t.title}</h2>
        {applicationLabel ? (
          <p id={labelId} style={styles.label}>
            {t.forLabel}: <span style={styles.labelStrong}>{applicationLabel}</span>
          </p>
        ) : null}

        <label style={styles.field}>
          <span style={styles.fieldLabel}>{t.date}</span>
          <input
            ref={dateRef}
            type="date"
            value={date}
            onChange={event => setDate(event.target.value)}
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>{t.time}</span>
          <input
            type="time"
            value={time}
            onChange={event => setTime(event.target.value)}
            style={styles.input}
          />
        </label>

        <div style={styles.actions}>
          <button type="button" style={styles.cancelBtn} onClick={() => onCancel?.()}>
            {t.cancel}
          </button>
          <button
            type="button"
            style={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!date}
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InterviewDateModal;
