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
        height: 3px;
        background: linear-gradient(to right,
        ${({ theme }) => theme.colors.secondary},
        ${({ theme }) => theme.colors.accent},
        ${({ theme }) => theme.colors.secondary}
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
        color: ${({ theme }) => theme.colors.light};
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
        opacity: 0.9;
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
            opacity: 0.9;

            &:hover {
                color: ${({ theme }) => theme.colors.secondary};
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
            color: ${({ theme }) => theme.colors.light};
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
                    <h3>About Me</h3>
                    <p>
                        Data Scientist & ML Engineer with experience in creating real-time personalization engines,
                        sentiment analysis systems, and predictive models that drive business value.
                    </p>
                    <SocialLinks>
                        <a href="https://github.com/" aria-label="GitHub" target="_blank" rel="noopener noreferrer">GH</a>
                        <a href="https://www.linkedin.com/in/waithira-macharia/" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">LI</a>
                    </SocialLinks>
                </FooterSection>

                <FooterSection>
                    <h3>Quick Links</h3>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/experience">Experience</Link></li>
                        <li><Link to="/education">Education</Link></li>
                        <li><Link to="/skills">Skills</Link></li>
                        <li><Link to="/projects">Projects</Link></li>
                        <li><Link to="/blog">Blog</Link></li>
                        <li><Link to="/contact">Contact</Link></li>
                    </ul>
                </FooterSection>

                <FooterSection>
                    <h3>Contact Info</h3>
                    <ul>
                        <li>waithiramacharia285@gmail.com</li>
                        <li>Walldorf, Germany</li>
                    </ul>
                </FooterSection>
            </FooterContent>

            <FooterBottom>
                <p>
                    &copy; {currentYear} Jane Waithira. All rights reserved.
                </p>
            </FooterBottom>
        </FooterContainer>
    );
}

export default Footer;