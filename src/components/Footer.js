// src/components/Footer.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const FooterContainer = styled.footer`
  background-color: ${({ theme }) => theme.colors.dark};
  color: ${({ theme }) => theme.colors.light};
  padding: ${({ theme }) => theme.spacing.xlarge} 0;
  position: relative;
  
  &:before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 5px;
    background: linear-gradient(to right, 
      ${({ theme }) => theme.colors.primary}, 
      ${({ theme }) => theme.colors.secondary}, 
      ${({ theme }) => theme.colors.primary}
    );
  }
`;

const FooterContent = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.large};
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.xlarge};
`;

const FooterSection = styled.div`
  h3 {
    font-family: ${({ theme }) => theme.fonts.heading};
    color: ${({ theme }) => theme.colors.secondary};
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    position: relative;
    display: inline-block;
    
    &:after {
      content: "";
      display: block;
      width: 40px;
      height: 2px;
      background-color: ${({ theme }) => theme.colors.secondary};
      margin-top: ${({ theme }) => theme.spacing.small};
    }
  }
  
  p {
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    font-size: 0.9rem;
    line-height: 1.6;
  }
  
  ul {
    list-style: none;
    
    li {
      margin-bottom: ${({ theme }) => theme.spacing.small};
    }
    
    a {
      color: ${({ theme }) => theme.colors.light};
      text-decoration: none;
      transition: color 0.2s ease;
      display: inline-block;
      
      &:hover {
        color: ${({ theme }) => theme.colors.secondary};
        transform: translateX(2px);
      }
      
      &:before {
        content: "→";
        margin-right: ${({ theme }) => theme.spacing.small};
        transition: transform 0.2s ease;
        display: inline-block;
      }
      
      &:hover:before {
        transform: translateX(2px);
      }
    }
  }
`;

const SocialLinks = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.medium};
  margin-top: ${({ theme }) => theme.spacing.medium};
  
  a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme.colors.light};
    transition: all 0.3s ease;
    
    &:hover {
      background-color: ${({ theme }) => theme.colors.secondary};
      color: ${({ theme }) => theme.colors.dark};
      transform: translateY(-3px);
    }
  }
`;

const FooterBottom = styled.div`
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: ${({ theme }) => theme.spacing.xlarge};
  padding-top: ${({ theme }) => theme.spacing.large};
  text-align: center;
  max-width: ${({ theme }) => theme.maxWidth};
  margin-left: auto;
  margin-right: auto;
  padding-left: ${({ theme }) => theme.spacing.large};
  padding-right: ${({ theme }) => theme.spacing.large};
  
  p {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
  }
  
  a {
    color: ${({ theme }) => theme.colors.secondary};
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <FooterContainer>
            <FooterContent>
                <FooterSection>
                    <h3>About Roman Coder</h3>
                    <p>
                        A blog dedicated to exploring programming concepts through
                        the lens of ancient Roman wisdom and engineering principles.
                    </p>
                    <SocialLinks>
                        <a href="https://github.com/" aria-label="GitHub" target="_blank" rel="noopener noreferrer">GH</a>
                        <a href="https://twitter.com/" aria-label="Twitter" target="_blank" rel="noopener noreferrer">TW</a>
                        <a href="https://linkedin.com/" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">LI</a>
                        <a href="https://dev.to/" aria-label="Dev.to" target="_blank" rel="noopener noreferrer">DV</a>
                    </SocialLinks>
                </FooterSection>

                <FooterSection>
                    <h3>Navigation</h3>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/blog">Articles</Link></li>
                        <li><Link to="/projects">Projects</Link></li>
                        <li><Link to="/about">About</Link></li>
                    </ul>
                </FooterSection>

                <FooterSection>
                    <h3>Categories</h3>
                    <ul>
                        <li><Link to="/category/react">React Development</Link></li>
                        <li><Link to="/category/python">Python Programming</Link></li>
                        <li><Link to="/category/algorithms">Algorithms & Data Structures</Link></li>
                        <li><Link to="/category/philosophy">Programming Philosophy</Link></li>
                    </ul>
                </FooterSection>
            </FooterContent>

            <FooterBottom>
                <p>
                    &copy; {currentYear} Roman Coder. All rights reserved. Built with
                    <a href="https://reactjs.org/" target="_blank" rel="noopener noreferrer"> React</a> and
                    <a href="https://styled-components.com/" target="_blank" rel="noopener noreferrer"> Styled Components</a>.
                </p>
            </FooterBottom>
        </FooterContainer>
    );
}

export default Footer;