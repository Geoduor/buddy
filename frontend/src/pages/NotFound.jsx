import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section>
      <h1>Page not found</h1>
      <p className="lead">That address does not lead anywhere in Buddy.</p>
      <Link className="btn btn-primary" to="/">Go to Home</Link>
    </section>
  )
}
