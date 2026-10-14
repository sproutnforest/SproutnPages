import React from 'react';

// Sample card data matching the warm color scheme
const cards = [
  {
    id: 1,
    title: 'Machine Learning',
    description: 'Developing models for clustering, classification, forecasting, and regression using Python.',
    tag: 'ML & AI',
    buttonText: 'View Projects',
    buttonBg: '#e5a33c',
  },
  {
    id: 2,
    title: 'Software Engineering',
    description: 'Building and deploying responsive, scalable web applications with modern frontend & backend tech.',
    tag: 'Web Dev',
    buttonText: 'See Stack',
    buttonBg: '#d96b43',
  },
  {
    id: 3,
    title: 'Creative Works',
    description: 'Exploring traditional & pop dance choreography, literature, and multidisciplinary design.',
    tag: 'Hobbies',
    buttonText: 'Explore More',
    buttonBg: '#d96b43',
  },
];

export default function HomePage() {
  return (
    <div style={styles.page}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.brandName}>SproutnPages</div>

          {/* Social / Header Action Icons */}
          <div style={styles.socialIcons}>
            {/* Stack of Books Icon */}
            <a href="#" style={styles.socialLink} aria-label="Books">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
                <path d="M6.5 6H20"></path>
                <path d="M6.5 10H20"></path>
                <path d="M6.5 14H20"></path>
                <path d="M4 6H2"></path>
                <path d="M4 10H2"></path>
                <path d="M4 14H2"></path>
              </svg>
            </a>

            {/* Profile Icon */}
            <a href="#" style={styles.socialLink} aria-label="Profile">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main Full-Width Container */}
      <main style={styles.main}>
        {/* Banner Hero Section */}
        <div style={styles.heroBanner}>
          <div style={styles.heroLeft}>
            <span style={styles.subGreeting}>Sprouting Pages, Sprout in Pages</span>
          </div>

          <div style={styles.heroRight}>
            <h1 style={styles.heroTitle}>SproutnPages</h1>
          </div>
        </div>

        {/* Section Heading */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Explore your next pages!</h2>
        </div>

        {/* Feature Cards Grid */}
        <div style={styles.cardGrid}>
          {cards.map((card) => (
            <div key={card.id} style={styles.card}>
              <div>
                <div style={styles.cardTag}>{card.tag}</div>
                <h3 style={styles.cardTitle}>{card.title}</h3>
                <p style={styles.cardDescription}>{card.description}</p>
              </div>

              <button style={{ ...styles.cardButton, backgroundColor: card.buttonBg }}>
                {card.buttonText}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// Added 'as const' at the end to satisfy TypeScript CSS properties strictly
const styles = {
  page: {
    backgroundColor: '#f5efe0',
    minHeight: '100vh',
    width: '100%',
    color: '#d96b43',
    fontFamily: 'Georgia, "Times New Roman", serif',
    paddingBottom: '60px',
    boxSizing: 'border-box' as const,
  },
  header: {
    width: '100%',
    padding: '24px 0',
    boxSizing: 'border-box' as const,
  },
  headerContent: {
    width: '100%',
    padding: '0 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxSizing: 'border-box' as const,
  },
  brandName: {
    fontSize: '22px',
    color: '#d96b43',
    fontWeight: 'bold' as const,
  },
  socialIcons: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  socialLink: {
    color: '#d96b43',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    width: '100%',
    padding: '0 40px 80px 40px',
    boxSizing: 'border-box' as const,
  },
  heroBanner: {
    width: '100%',
    backgroundColor: '#32422e',
    borderRadius: '4px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    padding: '48px 40px',
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '32px',
    boxSizing: 'border-box' as const,
  },
  heroLeft: {
    flex: 1,
  },
  subGreeting: {
    color: '#e5a33c',
    fontSize: '22px',
    fontWeight: 'normal' as const,
  },
  heroRight: {
    flex: '0 0 auto',
  },
  heroTitle: {
    color: '#e5a33c',
    fontSize: '44px',
    fontWeight: '900' as const,
    margin: 0,
    fontFamily: 'Georgia, serif',
  },
  sectionHeader: {
    marginTop: '48px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  sectionTitle: {
    color: '#32422e',
    fontSize: '28px',
    fontWeight: 'bold' as const,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  card: {
    backgroundColor: '#32422e',
    borderRadius: '4px',
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    minHeight: '220px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    boxSizing: 'border-box' as const,
  },
  cardTag: {
    color: '#e5a33c',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '8px',
    fontFamily: 'system-ui, sans-serif',
  },
  cardTitle: {
    color: '#f5efe0',
    fontSize: '22px',
    fontWeight: 'bold' as const,
    margin: '0 0 12px 0',
  },
  cardDescription: {
    color: '#c2cdbb',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  cardButton: {
    border: 'none',
    color: '#32422e',
    padding: '10px 18px',
    borderRadius: '8px',
    fontWeight: 'bold' as const,
    fontSize: '13px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
} as const;