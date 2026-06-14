// src/pages/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import Divider from '../components/RomanDivider';

const HeroSection = styled.section`
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.xlarge};
  background-color: ${({ theme }) => theme.colors.background};
  position: relative;
  
  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
  }
`;

const HeroContent = styled.div`
  max-width: 600px;
  
  @media (min-width: 768px) {
    margin-right: ${({ theme }) => theme.spacing.xlarge};
  }
`;

const HeroImage = styled.div`
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.accent};
  background-image: url('${process.env.PUBLIC_URL}/images/profile.jpg');
  background-size: cover;
  background-position: center;
  margin: ${({ theme }) => theme.spacing.xlarge} auto 0;
  border: 4px solid ${({ theme }) => theme.colors.light};
  box-shadow: ${({ theme }) => theme.shadows.medium};

  @media (min-width: 768px) {
    margin: 0;
  }
`;

const Name = styled.h1`
  font-size: 3rem;
  margin-bottom: ${({ theme }) => theme.spacing.small};
  color: ${({ theme }) => theme.colors.primary};
  
  &:after {
    display: none;
  }
`;

const Title = styled.h2`
  font-size: 1.5rem;
  margin-bottom: ${({ theme }) => theme.spacing.large};
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 400;
`;

const Bio = styled.div`
    margin-bottom: ${({ theme }) => theme.spacing.large};

    p {
        font-size: 1.1rem;
        line-height: 1.7;
        margin-bottom: ${({ theme }) => theme.spacing.medium};

        &:last-child {
            margin-bottom: 0;
        }
    }
`;

const ButtonGroup = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.medium};
`;

const Button = styled(Link)`
  display: inline-block;
  padding: ${({ theme }) => `${theme.spacing.medium} ${theme.spacing.large}`};
  background-color: ${({ theme, secondary }) => secondary ? 'transparent' : theme.colors.secondary};
  color: ${({ theme, secondary }) => secondary ? theme.colors.secondary : theme.colors.light};
  font-weight: 500;
  font-size: 1rem;
  letter-spacing: 0.5px;
  border: 2px solid ${({ theme }) => theme.colors.secondary};
  border-radius: ${({ theme }) => theme.borderRadius};
  transition: all 0.3s ease;
  text-decoration: none;
  
  &:hover {
    background-color: ${({ theme, secondary }) => secondary ? theme.colors.secondary : theme.colors.highlight};
    border-color: ${({ theme, secondary }) => secondary ? theme.colors.secondary : theme.colors.highlight};
    color: ${({ theme }) => theme.colors.light};
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.medium};
  }
`;

const HighlightsSection = styled.section`
  padding: ${({ theme }) => theme.spacing.xlarge} ${({ theme }) => theme.spacing.large};
  max-width: ${({ theme }) => theme.maxWidth};
  margin: 0 auto;
`;

const SectionTitle = styled.h2`
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
    position: relative;

    &:after {
        content: "";
        display: block;
        width: 60px;
        height: 3px;
        background-color: ${({ theme }) => theme.colors.secondary};
        margin: ${({ theme }) => theme.spacing.small} auto 0;
    }
`;

const HighlightsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: ${({ theme }) => theme.spacing.large};
`;

const HighlightCard = styled.div`
  background-color: ${({ theme }) => theme.colors.light};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spacing.large};
  box-shadow: ${({ theme }) => theme.shadows.small};
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: ${({ theme }) => theme.shadows.medium};
  }
  
  h3 {
    font-size: 1.4rem;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    color: ${({ theme }) => theme.colors.primary};
    
    span {
      color: ${({ theme }) => theme.colors.secondary};
    }
  }
  
  p {
    font-size: 0.95rem;
    line-height: 1.6;
  }
`;

function HomePage() {
    return (
        <main>
            <HeroSection>
                <HeroContent>
                    <Name>Jane Waithira</Name>
                    <Title>Data Scientist & ML Engineer</Title>
                    <Bio>
                        <p>
                            I love solving problems with data and I'm adamant about finding the simplest (often the most beautiful) solution that actually works.
                        </p>
                        <p>
                            I'm an AI/ML Developer at SAP in Germany, where I build applied AI and GenAI for cloud infrastructure. Before that, I spent years in East Africa's telecom industry turning messy, high-volume data into systems that made real decisions: a reinforcement learning engine personalising offers for 5M+ customers, causal models that changed how we thought about revenue, GenAI systems that made sense of customer feedback at scale.
                        </p>
                        <p>
                            What I've learned: the right solution isn't always the most sophisticated one. Sometimes it's an XGBoost model. Sometimes it's a well-written script. And sometimes, only sometimes :)), it's an LLM. The skill is knowing which layer fits where.
                        </p>
                        <p>
                            I thrive on breaking complex problems into the right pieces, collaborating with teams who care about getting it right, and building AI that makes it to production.
                        </p>
                    </Bio>
                    <ButtonGroup>
                        <Button to="/experience">View Experience</Button>
                        <Button to="/contact" secondary>Get In Touch</Button>
                    </ButtonGroup>
                </HeroContent>
                <HeroImage />
            </HeroSection>

            <HighlightsSection>
                <SectionTitle>Career Highlights</SectionTitle>
                <HighlightsGrid>
                    <HighlightCard>
                        <h3>Real-time <span>Personalization</span></h3>
                        <p>
                            Led a personalization engine project recommending data offers to 5M+ customers,
                            using Q-learning and Multi-Armed Bandit approaches, with validated improvements through A/B testing.
                        </p>
                    </HighlightCard>

                    <HighlightCard>
                        <h3>GenAI for <span>Customer Feedback</span></h3>
                        <p>
                            Used GenAI for topic modeling and sentiment analysis, integrating it into a system
                            that autonomously responds to customer feedback, improving the Net Promoter Score.
                        </p>
                    </HighlightCard>

                    <HighlightCard>
                        <h3>ML for <span>Revenue Growth</span></h3>
                        <p>
                            Developed a voice diagnostics model using causal graphs to identify products
                            significantly impacting voice revenue trends, enabling strategic focus on high-impact areas.
                        </p>
                    </HighlightCard>

                    <HighlightCard>
                        <h3>Forecasting <span>Customer Behavior</span></h3>
                        <p>
                            Built a survival model using random survival forests to predict customer phone change patterns,
                            resulting in targeted campaigns with 100% month-on-month conversion uplift.
                        </p>
                    </HighlightCard>
                </HighlightsGrid>
            </HighlightsSection>

            <Divider />

            <HighlightsSection>
                <SectionTitle>Why Work With Me</SectionTitle>
                <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                    <p>
                        With a background in Telecommunications and Information Engineering and a passion for data science,
                        I bring both technical depth and business acumen to every project. I've successfully
                        implemented machine learning solutions that have directly impacted business metrics and
                        improved customer experiences.
                    </p>
                    <p>
                        I'm committed to continuous learning and staying at the forefront of AI advancements,
                        as evidenced by my participation in competitions, workshops, and mentorship programs.
                    </p>
                    <Button to="/contact" secondary style={{ marginTop: '20px' }}>
                        Contact Me
                    </Button>
                </div>
            </HighlightsSection>
        </main>
    );
}

export default HomePage;