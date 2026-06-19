import React from 'react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-brand-col">
            <span className="brand-name" style={{fontSize: '1.1rem'}}>perenti</span>
            <p className="footer-brand-desc">Smart Events, Seamless Outcomes. Simplifying how communities connect and grow.</p>
          </div>
          <div className="footer-links-col">
            <h4 className="footer-col-title">Platform</h4>
            <a href="#" className="footer-link">Features</a>
            <a href="#" className="footer-link">Pricing</a>
            <a href="#" className="footer-link">For Organizers</a>
          </div>
          <div className="footer-links-col">
            <h4 className="footer-col-title">Company</h4>
            <a href="#" className="footer-link">About Us</a>
            <a href="#" className="footer-link">Careers</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
          <div className="footer-links-col">
            <h4 className="footer-col-title">Legal</h4>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Refund Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Perenti Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
