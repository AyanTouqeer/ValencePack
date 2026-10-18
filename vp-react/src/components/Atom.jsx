// The animated atom mark — reused in the topbar and the chat typing indicator.
export default function Atom({ className = 'atom' }) {
  return (
    <span className={className} aria-hidden="true">
      <span className="orb s1"><span className="ring"><i className="electron"></i></span></span>
      <span className="orb s2"><span className="ring"><i className="electron"></i></span></span>
      <span className="orb s3"><span className="ring"><i className="electron"></i></span></span>
      <span className="box"></span>
    </span>
  )
}
