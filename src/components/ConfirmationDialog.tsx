import { Modal } from "./Modal";

type Props = {
  title: string;
  text: string;
  onAnswer: (answer: boolean) => void;
};
export function ConfirmationDialog({ title, text, onAnswer }: Props) {
  return (
    <Modal id="confirmDialog" onDismiss={() => onAnswer(false)}>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="dialog-actions">
        <button onClick={() => onAnswer(false)}>Cancel</button>
        <button className="primary" onClick={() => onAnswer(true)}>
          Continue
        </button>
      </div>
    </Modal>
  );
}
