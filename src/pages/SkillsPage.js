// src/pages/SkillsPage.js
import React from 'react';
import styled from 'styled-components';
import Divider from '../components/RomanDivider';

const PageContainer = styled.div`
    max-width: 900px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.xlarge};
`;

const PageTitle = styled.h1`
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const SectionTitle = styled.h2`
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.large};
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
        color: ${({ theme }) => theme.colors.secondary};
    }

    ul {
        list-style: none;
        padding: 0;

        li {
            margin-bottom: ${({ theme }) => theme.spacing.small};
            font-size: 0.95rem;
        }
    }
`;

const TechnicalSection = styled.section`
    margin-top: ${({ theme }) => theme.spacing.xlarge};
`;

const TechnicalContent = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: ${({ theme }) => theme.spacing.large};
`;

const TechnicalCard = styled.div`
  background-color: ${({ theme }) => theme.colors.light};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spacing.large};
  box-shadow: ${({ theme }) => theme.shadows.small};
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: ${({ theme }) => theme.shadows.medium};
  }
  
  h3 {
    font-size: 1.2rem;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    color: ${({ theme }) => theme.colors.secondary};
    position: relative;
    display: inline-block;
    
    &:after {
      content: "";
      display: block;
      width: 40px;
      height: 2px;
      background-color: ${({ theme }) => theme.colors.secondary};
      margin-top: ${({ theme }) => theme.spacing.small};
      opacity: 0.6;
    }
  }
  
  ul {
    padding-left: 20px;
    
    li {
      margin-bottom: ${({ theme }) => theme.spacing.small};
      font-size: 0.95rem;
    }
  }
`;

function SkillsPage() {
    const skills = [
        {
            category: "Data Science",
            items: [
                "Machine Learning",
                "Deep Learning",
                "Natural Language Processing",
                "Computer Vision",
                "Time Series Analysis",
                "A/B Testing",
                "Causal Inference",
                "Recommendation Systems"
            ]
        },
        {
            category: "Programming",
            items: [
                "Python",
                "R",
                "SQL",
                "JavaScript",
                "PHP/Laravel",
                "Java",
                "Scala"
            ]
        },
        {
            category: "ML/AI Tools",
            items: [
                "TensorFlow",
                "PyTorch",
                "Scikit-learn",
                "Pandas",
                "NumPy",
                "Matplotlib/Seaborn",
                "SpaCy",
                "NLTK"
            ]
        },
        {
            category: "Big Data",
            items: [
                "Apache Spark",
                "Databricks",
                "Hadoop",
                "AWS",
                "Google Cloud",
                "Airflow",
                "Kubernetes",
                "Docker"
            ]
        }
    ];

    const technicalAreas = [
        {
            title: "Machine Learning",
            skills: [
                "Supervised learning algorithms (regression, classification, ensemble methods)",
                "Reinforcement learning (Q-learning, Multi-Armed Bandits)",
                "Deep learning (CNN, RNN, Transformers)",
                "Model optimization and hyperparameter tuning",
                "Model deployment and monitoring"
            ]
        },
        {
            title: "Data Analysis",
            skills: [
                "Statistical analysis and hypothesis testing",
                "Exploratory data analysis",
                "Feature engineering and selection",
                "Dimensionality reduction techniques",
                "Data visualization and storytelling"
            ]
        },
        {
            title: "Big Data Processing",
            skills: [
                "Distributed computing frameworks",
                "Cloud-based data processing",
                "ETL pipeline development",
                "Real-time and batch processing",
                "Data architecture design"
            ]
        }
    ];

    return (
        <PageContainer>
            <PageTitle>Skills & Expertise</PageTitle>

            <SkillsSection>
                <SkillsGrid>
                    {skills.map((skillGroup, index) => (
                        <SkillCard key={index}>
                            <h3>{skillGroup.category}</h3>
                            <ul>
                                {skillGroup.items.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </SkillCard>
                    ))}
                </SkillsGrid>
            </SkillsSection>

            <Divider />

            <TechnicalSection>
                <SectionTitle>Technical Expertise</SectionTitle>
                <TechnicalContent>
                    {technicalAreas.map((area, index) => (
                        <TechnicalCard key={index}>
                            <h3>{area.title}</h3>
                            <ul>
                                {area.skills.map((skill, i) => (
                                    <li key={i}>{skill}</li>
                                ))}
                            </ul>
                        </TechnicalCard>
                    ))}
                </TechnicalContent>
            </TechnicalSection>

            <Divider />

            <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                <p>
                    My technical skills are continuously evolving as I explore new technologies and methodologies.
                    I'm particularly passionate about the intersection of machine learning, causal inference, and business strategy.
                </p>
            </div>
        </PageContainer>
    );
}

export default SkillsPage;