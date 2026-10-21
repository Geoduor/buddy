export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src="/brand/buddy-mark.png" alt="" width="44" height="35" />
          <p>
            Buddy is a study helper for people preparing for the Microsoft Azure Fundamentals exam (AZ-900).
            Every question and note is written by our team in our own words.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="https://learn.microsoft.com/credentials/certifications/resources/study-guides/az-900" target="_blank" rel="noreferrer">Official AZ-900 study guide</a>
          <a href="https://github.com/Geoduor/buddy" target="_blank" rel="noreferrer">Source code on GitHub</a>
        </nav>
      </div>
      <p className="footer-legal">Unofficial - not affiliated with or endorsed by Microsoft</p>
    </footer>
  )
}
