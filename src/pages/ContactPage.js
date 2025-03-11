// src/pages/ContactPage.js
import React, { useState } from 'react';
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

const ContactLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.xlarge};
  
  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ContactForm = styled.form`
  background-color: ${({ theme }) => theme.colors.light};
  padding: ${({ theme }) => theme.spacing.large};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.medium};
`;

const FormTitle = styled.h2`
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

const FormGroup = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.large};
`;

const Label = styled.label`
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing.small};
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.medium};
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius};
  font-size: 1rem;
  font-family: ${({ theme }) => theme.fonts.body};
  transition: border-color 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.secondary};
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.medium};
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius};
  font-size: 1rem;
  font-family: ${({ theme }) => theme.fonts.body};
  resize: vertical;
  min-height: 150px;
  transition: border-color 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.secondary};
  }
`;

const SubmitButton = styled.button`
  padding: ${({ theme }) => `${theme.spacing.medium} ${theme.spacing.large}`};
  background-color: ${({ theme }) => theme.colors.secondary};
  color: ${({ theme }) => theme.colors.light};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.highlight};
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.small};
  }
  
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
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

const SuccessMessage = styled.div`
  padding: ${({ theme }) => theme.spacing.medium};
  background-color: #dff0d8;
  color: #3c763d;
  border-radius: ${({ theme }) => theme.borderRadius};
  margin-bottom: ${({ theme }) => theme.spacing.large};
  text-align: center;
  animation: fadeIn 0.5s;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // In a real app, you would send the form data to a server here
        console.log('Form submitted:', formData);
        setSubmitted(true);

        // Reset form after submission
        setFormData({
            name: '',
            email: '',
            subject: '',
            message: ''
        });

        // Reset submission status after 5 seconds
        setTimeout(() => {
            setSubmitted(false);
        }, 5000);
    };

    return (
        <PageContainer>
            <PageTitle>Get In Touch</PageTitle>

            <ContactLayout>
                <ContactForm onSubmit={handleSubmit}>
                    <FormTitle>Send Me a Message</FormTitle>

                    {submitted && (
                        <SuccessMessage>
                            Thank you for your message! I'll get back to you soon.
                        </SuccessMessage>
                    )}

                    <FormGroup>
                        <Label htmlFor="name">Your Name</Label>
                        <Input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                            type="text"
                            id="subject"
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            required
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label htmlFor="message">Message</Label>
                        <TextArea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            required
                        />
                    </FormGroup>

                    <SubmitButton type="submit">Send Message</SubmitButton>
                </ContactForm>

                <ContactInfo>
                    <InfoTitle>Contact Information</InfoTitle>

                    <InfoItem>
                        <h3>Email</h3>
                        <p><a href="mailto:jane.waithira@example.com">jane.waithira@example.com</a></p>
                    </InfoItem>

                    <InfoItem>
                        <h3>Phone</h3>
                        <p>+254 (0)721615405</p>
                    </InfoItem>

                    <InfoItem>
                        <h3>Location</h3>
                        <p>Nairobi, Kenya</p>
                    </InfoItem>

                    <InfoItem>
                        <h3>Connect With Me</h3>
                        <SocialLinks>
                            <a href="https://github.com/" aria-label="GitHub" target="_blank" rel="noopener noreferrer">GH</a>
                            <a href="https://linkedin.com/in/jane-waithira" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">LI</a>
                            <a href="https://twitter.com/" aria-label="Twitter" target="_blank" rel="noopener noreferrer">TW</a>
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
            </ContactLayout>
        </PageContainer>
    );
}

export default ContactPage;