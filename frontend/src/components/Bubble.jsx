// An answer option drawn like a bubble on an exam answer sheet.
export default function Bubble({ letter, text, state, disabled, onPick }) {
  // state: idle | picked | correct | wrong
  return (
    <button type="button" className={`option option-${state}`} disabled={disabled} onClick={onPick} aria-label={`Option ${letter}: ${text}`}>
      <span className="bubble" aria-hidden="true"><span>{letter}</span></span>
      <span className="option-text">{text}</span>
      {state === 'correct' && <span className="option-flag">Correct answer</span>}
      {state === 'wrong' && <span className="option-flag">Your answer</span>}
    </button>
  )
}
