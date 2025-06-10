import "./Modal.css";

export default function Modal({ open, title, message, onClose, action }) {
  if (!open) return null;                // nothing to render

  return (
    <div className="modal-overlay">
      <div className="modal-window">
        <h3>{title}</h3>
        <p>{message}</p>

        <div className="modal-actions">
          {action /* optional extra button */ }
          <button className="modal-btn primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
