// src/pages/AboutPage.js
import React from 'react';
import styled from 'styled-components';

const AboutContainer = styled.div`
    max-width: 800px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.xlarge};
`;

const PageTitle = styled.h1`
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
    position: relative;

    &:after {
        content: "";
        display: block;
        width: 80px;
        height: 4px;
        background-color: ${({ theme }) => theme.colors.secondary};
        margin: ${({ theme }) => theme.spacing.small} auto 0;
    }
`;

const ProfileSection = styled.section`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};

    @media (min-width: 768px) {
        flex-direction: row;
        align-items: flex-start;
    }
`;

const ProfileImage = styled.div`
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.accent};
    background-image: url('/images/author.jpg');
    background-size: cover;
    margin-bottom: ${({ theme }) => theme.spacing.large};
    border: 4px solid ${({ theme }) => theme.colors.secondary};
    box-shadow: ${({ theme }) => theme.shadows.medium};

    @media (min-width: 768px) {
        margin-right: ${({ theme }) => theme.spacing.xlarge};
        margin-bottom: 0;
    }
`;

const ProfileInfo = styled.div`
    text-align: center;

    @media (min-width: 768px) {
        text-align: left;
    }

    h2 {
        margin-bottom: ${({ theme }) => theme.spacing.medium};
        font-size: 1.8rem;
    }

    p {
        margin-bottom: ${({ theme }) => theme.spacing.medium};
    }
`;

const SectionTitle = styled.h2`
    margin-top: ${({ theme }) => theme.spacing.xlarge};
    margin-bottom: ${({ theme }) => theme.spacing.large};
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

const SkillsSection = styled.section`
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const SkillsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: ${({ theme }) => theme.spacing.large};
`;

const SkillCard = styled.div`
    background-color: ${({ theme }) => theme.colors.light};
    border-radius: ${({ theme }) => theme.borderRadius};
    padding: ${({ theme }) => theme.spacing.large};
    box-shadow: ${({ theme }) => theme.shadows.small};
    text-align: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
        transform: translateY(-5px);
        box-shadow: ${({ theme }) => theme.shadows.medium};
    }

    h3 {
        margin-bottom: ${({ theme }) => theme.spacing.medium};
        color: ${({ theme }) => theme.colors.primary};
    }

    p {
        font-size: 0.9rem;
        margin-bottom: 0;
    }
`;

const TimelineSection = styled.section`
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const Timeline = styled.div`
    position: relative;

    &:before {
        content: "";
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 100%;
        background-color: ${({ theme }) => theme.colors.secondary};
        opacity: 0.3;

        @media (max-width: 768px) {
            left: 20px;
            transform: none;
        }
    }
`;

const TimelineItem = styled.div`
    display: flex;
    justify-content: space-between;
    padding-bottom: ${({ theme }) => theme.spacing.xlarge};

    @media (max-width: 768px) {
        flex-direction: column;
        padding-left: 50px;
    }

    &:last-child {
        padding-bottom: 0;
    }
`;

const TimelineDot = styled.div`
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.secondary};
    border: 4px solid ${({ theme }) => theme.colors.light};
    z-index: 1;

    @media (max-width: 768px) {
        left: 20px;
        transform: none;
    }
`;

const TimelineDate = styled.div`
    width: 45%;
    text-align: right;
    padding-right: ${({ theme }) => theme.spacing.xlarge};
    font-family: ${({ theme }) => theme.fonts.heading};
    font-weight: bold;
    color: ${({ theme }) => theme.colors.accent};
    position: relative;

    @media (max-width: 768px) {
        width: 100%;
        text-align: left;
        padding-right: 0;
        margin-bottom: ${({ theme }) => theme.spacing.small};
    }
`;

const TimelineContent = styled.div`
    width: 45%;
    padding-left: ${({ theme }) => theme.spacing.xlarge};

    @media (max-width: 768px) {
        width: 100%;
        padding-left: 0;
    }

    h3 {
        margin-bottom: ${({ theme }) => theme.spacing.small};
    }

    p {
        font-size: 0.9rem;
    }
`;

const RomanDivider = styled.div`
    display: flex;
    align-items: center;
    margin: ${({ theme }) => theme.spacing.xlarge} 0;

    &:before, &:after {
        content: "";
        flex-grow: 1;
        height: 1px;
        background-color: ${({ theme }) => theme.colors.secondary};
        opacity: 0.5;
    }

    span {
        padding: 0 ${({ theme }) => theme.spacing.medium};
        font-family: ${({ theme }) => theme.fonts.heading};
        color: ${({ theme }) => theme.colors.secondary};
        font-size: 1.5rem;
    }
`;

const ContactSection = styled.section`
    text-align: center;
    max-width: 600px;
    margin: 0 auto;
`;

const ContactButton = styled.a`
    display: inline-block;
    padding: ${({ theme }) => `${theme.spacing.medium} ${theme.spacing.large}`};
    background-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.light};
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 2px solid ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius};
    margin-top: ${({ theme }) => theme.spacing.large};
    transition: all 0.3s ease;
    text-decoration: none;

    &:hover {
        background-color: ${({ theme }) => theme.colors.accent};
        border-color: ${({ theme }) => theme.colors.accent};
        transform: translateY(-2px);
        box-shadow: ${({ theme }) => theme.shadows.medium};
    }
`;

function AboutPage() {
    return (
        <AboutContainer>
            <PageTitle>About Me</PageTitle>

            <ProfileSection>
                <ProfileImage />
                <ProfileInfo>
                    <h2>Marcus Aurelius</h2>
                    <p>
                        Full Stack Developer with over 5 years of experience specializing in React and Node.js.
                        Passionate about clean code, Roman history, and bringing ancient wisdom to modern technology.
                    </p>
                    <p>
                        When I'm not coding, you can find me reading philosophy, exploring ancient ruins,
                        or practicing Stoicism in my daily life.
                    </p>
                </ProfileInfo>
            </ProfileSection>

            <SectionTitle>Technical Skills</SectionTitle>
            <SkillsSection>
                <SkillsGrid>
                    <SkillCard>
                        <h3>Frontend</h3>
                        <p>React, Redux, TypeScript, CSS-in-JS, NextJS</p>
                    </SkillCard>
                    <SkillCard>
                        <h3>Backend</h3>
                        <p>Node.js, Express, Python, Django, RESTful APIs</p>
                    </SkillCard>
                    <SkillCard>
                        <h3>Database</h3>
                        <p>MongoDB, PostgreSQL, Firebase, Redis</p>
                    </SkillCard>
                    <SkillCard>
                        <h3>DevOps</h3>
                        <p>Docker, Kubernetes, CI/CD, AWS, Netlify</p>
                    </SkillCard>
                    <SkillCard>
                        <h3>Tools</h3>
                        <p>Git, GitHub, VS Code, Webpack, Jest, Cypress</p>
                    </SkillCard>
                    <SkillCard>
                        <h3>Methodologies</h3>
                        <p>Agile, Scrum, TDD, Clean Architecture</p>
                    </SkillCard>
                </SkillsGrid>
            </SkillsSection>

            <SectionTitle>Experience</SectionTitle>
            <TimelineSection>
                <Timeline>
                    <TimelineItem>
                        <TimelineDot />
                        <TimelineDate>2023 - Present</TimelineDate>
                        <TimelineContent>
                            <h3>Senior Frontend Developer</h3>
                            <p>Modern Empire Technologies</p>
                            <p>Leading a team of developers to build scalable web applications with React and TypeScript.</p>
                        </TimelineContent>
                    </TimelineItem>

                    <TimelineItem>
                        <TimelineDot />
                        <TimelineDate>2021 - 2023</TimelineDate>
                        <TimelineContent>
                            <h3>Full Stack Developer</h3>
                            <p>Senate Systems Inc.</p>
                            <p>Developed and maintained RESTful APIs using Node.js and Express, while building interactive UIs with React.</p>
                        </TimelineContent>
                    </TimelineItem>

                    <TimelineItem>
                        <TimelineDot />
                        <TimelineDate>2019 - 2021</TimelineDate>
                        <TimelineContent>
                            <h3>Junior Web Developer</h3>
                            <p>Colosseum Creations</p>
                            <p>Started my career building responsive websites and implementing designs using HTML, CSS, and JavaScript.</p>
                        </TimelineContent>
                    </TimelineItem>
                </Timeline>
            </TimelineSection>

            <RomanDivider>
                <span>⚜</span>
            </RomanDivider>

            <ContactSection>
                <SectionTitle style={{ textAlign: 'center' }}>Get In Touch</SectionTitle>
                <p>
                    Interested in working together or have questions about one of my articles?
                    Feel free to reach out. I'm always open to discussing new projects or opportunities.
                </p>
                <ContactButton href="mailto:contact@romancoder.com">
                    Send Message
                </ContactButton>
            </ContactSection>
        </AboutContainer>
    );
}

export default AboutPage;