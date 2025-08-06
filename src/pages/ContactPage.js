// src/pages/ContactPage.js
import React from 'react';
import styled from 'styled-components';

const PageContainer = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xlarge};
`;

const PageTitle = styled.h1`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const ContactInfo = styled.div`
  padding: ${({ theme }) => theme.spacing.large};
`;

const InfoTitle = styled.h2`
  margin-bottom: ${({ theme }) => theme.spacing.large};
  color: ${({ theme }) => theme.colors.primary};
  position: relative;
  
  &:after {
    content: "";
    display: block;
    width: 60px;
    height: 3px;
    background-color: ${({ theme }) => theme.colors.secondary};
    margin-top: ${({ theme }) => theme.spacing.small};
  }
`;

const InfoItem = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.large};
  
  h3 {
    font-size: 1.1rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};
    color: ${({ theme }) => theme.colors.secondary};
  }
  
  p {
    font-size: 1rem;
    margin-bottom: 0;
  }
  
  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    transition: color 0.2s ease;
    
    &:hover {
      color: ${({ theme }) => theme.colors.secondary};
    }
  }
`;

const SocialLinks = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.medium};
  margin-top: ${({ theme }) => theme.spacing.large};
  
  a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.secondary};
    color: ${({ theme }) => theme.colors.light};
    transition: all 0.3s ease;
    
    &:hover {
      background-color: ${({ theme }) => theme.colors.accent};
      transform: translateY(-3px);
      box-shadow: ${({ theme }) => theme.shadows.small};
    }
  }
`;

function ContactPage() {
    return (
        <PageContainer>
            <PageTitle>Get In Touch</PageTitle>
            <ContactInfo>
                <InfoTitle>Contact Information</InfoTitle>
                <InfoItem>
                    <h3>Email</h3>
                    <p>
                        <a href="mailto:waithiramacharia285@gmail.com">
                            waithiramacharia285@gmail.com
                        </a>
                    </p>
                </InfoItem>
                <InfoItem>
                    <h3>Location</h3>
                    <p>Walldorf, Germany</p>
                </InfoItem>
                <InfoItem>
                    <h3>Connect With Me</h3>
                    <SocialLinks>
                        <a href="https://github.com/Machariajane" aria-label="GitHub" target="_blank" rel="noopener noreferrer">GH</a>
                        <a href="https://www.linkedin.com/in/waithira-macharia/" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">LI</a>
                    </SocialLinks>
                </InfoItem>
                <InfoItem>
                    <h3>Availability</h3>
                    <p>
                        I'm always open to discussing new projects, opportunities, or collaborations.
                        Feel free to reach out and I'll get back to you as soon as possible.
                    </p>
                </InfoItem>
            </ContactInfo>
        </PageContainer>
    );
}

export default ContactPage;