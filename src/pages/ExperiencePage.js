// src/pages/ExperiencePage.js
import React from 'react';
import styled from 'styled-components';
import Divider from '../components/Divider';

const PageContainer = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xlarge};
`;

const PageTitle = styled.h1`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const ExperienceSection = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const Timeline = styled.div`
  position: relative;
  
  &:before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 3px;
    height: 100%;
    background-color: ${({ theme }) => theme.colors.secondary};
    opacity: 0.3;
    
    @media (min-width: 768px) {
      left: 50%;
      transform: translateX(-50%);
    }
  }
`;

const TimelineItem = styled.div`
  position: relative;
  padding-left: 30px;
  margin-bottom: ${({ theme }) => theme.spacing.xlarge};
  
  @media (min-width: 768px) {
    width: 50%;
    padding-left: 0;
    padding-right: 40px;
    margin-left: ${({ position }) => position === 'right' ? '50%' : 0};
    padding-left: ${({ position }) => position === 'right' ? '40px' : 0};
    padding-right: ${({ position }) => position === 'right' ? 0 : '40px'};
    text-align: ${({ position }) => position === 'right' ? 'left' : 'right'};
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const TimelineDot = styled.div`
  position: absolute;
  width: 16px;
  height: 16px;
  left: -8px;
  top: 5px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.secondary};
  z-index: 1;
  
  @media (min-width: 768px) {
    left: auto;
    right: ${({ position }) => position === 'right' ? 'auto' : '-8px'};
    left: ${({ position }) => position === 'right' ? '-8px' : 'auto'};
    transform: translateX(${({ position }) => position === 'right' ? 0 : 0});
  }
`;

const TimelineContent = styled.div`
  background-color: ${({ theme }) => theme.colors.light};
  padding: ${({ theme }) => theme.spacing.large};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.small};
`;

const JobTitle = styled.h3`
  font-size: 1.4rem;
  margin-bottom: ${({ theme }) => theme.spacing.small};
  color: ${({ theme }) => theme.colors.primary};
`;

const CompanyName = styled.h4`
  font-size: 1.1rem;
  margin-bottom: ${({ theme }) => theme.spacing.small};
  color: ${({ theme }) => theme.colors.secondary};
  font-weight: 600;
`;

const JobPeriod = styled.p`
  font-size: 0.9rem;
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  color: ${({ theme }) => theme.colors.text};
  opacity: 0.8;
  font-style: italic;
`;

const JobDescription = styled.div`
  ul {
    margin-top: ${({ theme }) => theme.spacing.medium};
    padding-left: 20px;
    
    li {
      margin-bottom: ${({ theme }) => theme.spacing.small};
      
      @media (min-width: 768px) {
        text-align: left;
      }
    }
  }
`;

function ExperiencePage() {
    const experiences = [
        {
            title: "ML Engineer",
            company: "SAP SE",
            location: "Germany",
            period: "February 2025 – September 2025",
            description: [
                "Integrating AI into the Field Services Management product under SCM."
            ]
        },
        {
            title: "Data Scientist",
            company: "Safaricom PLC",
            location: "Kenya",
            period: "November 2021 – present",
            description: [
                "Leading a real-time personalization engine project recommending data offers to 5M+ customers. Tasks include constructing offer recommendation models, generating reports, and conducting experiments (e.g., using Q learning/MAB and running A/B tests to assess improvements from baseline models).",
                "Used GenAI for topic modelling and sentiment analysis, integrating it into an end system that autonomously responds to customer feedback, thus improving the Net Promoter Score (NPS).",
                "Trained a reinforcement learning model for autonomous vehicles and secured the 3rd position in a company-wide AWS DeepRacer challenge.",
                "Developed a voice diagnostics model utilising causal graphs to identify and explain products significantly impacting voice revenue trends, enabling stakeholders to focus on high-impact areas.",
                "Collaborated with ML engineers to deploy a retail footfall time series forecasting model on AWS, predicting traffic in 55 retail stores using the Prophet model.",
                "Implemented PCA and KMeans to cluster customers and model fibre uptake and 5G acquisition campaigns, resulting in an 11% uplift.",
                "Constructed a survival model using random survival forests to predict when a customer is likely to change phones. The output was utilised for targeted campaigns by an e-commerce platform, resulting in a 100% uplift in month-on-month conversions.",
                "Authored a white paper, 'A Case for Humans,' exploring the effects of treating an MSISDN as a 'customer' in telcos rather than considering a customer holistically as a human interacting with a telco through multiple MSISDNs."
            ]
        },
        {
            title: "Data Science Intern",
            company: "Safaricom PLC",
            location: "Kenya",
            period: "February 2021 – August 2021",
            description: [
                "Conducted in-depth analysis of network data for over 100,000 cells, focusing on identifying and mitigating lost opportunities resulting from cell congestion.",
                "Analysed the impact of Fixed LTE products on cell utilisation and site revenue, fostering collaboration between the cellular network and fixed LTE teams.",
                "Strengthened data engineering skills by mastering Apache Spark on Databricks and Google Colab, particularly in handling big data jobs with extensive datasets."
            ]
        },
        {
            title: "Software Engineering Intern",
            company: "Mbitrix Technologies",
            location: "Kenya",
            period: "July 2019 – October 2019",
            description: [
                "Contributed to the development of features for a hospital management system using the Laravel PHP framework coupled with Bootstrap CSS.",
                "Ensured code quality by conducting rigorous unit tests and collaborated with a team of four members, utilising Trello to track progress.",
                "Contributed to the successful deployment of the hospital management system in two healthcare facilities in Thika, Kenya."
            ]
        }
    ];

    return (
        <PageContainer>
            <PageTitle>Professional Experience</PageTitle>

            <ExperienceSection>
                <Timeline>
                    {experiences.map((job, index) => (
                        <TimelineItem key={index} position={index % 2 === 0 ? 'left' : 'right'}>
                            <TimelineDot position={index % 2 === 0 ? 'left' : 'right'} />
                            <TimelineContent>
                                <JobTitle>{job.title}</JobTitle>
                                <CompanyName>{job.company}, {job.location}</CompanyName>
                                <JobPeriod>{job.period}</JobPeriod>
                                <JobDescription>
                                    <ul>
                                        {job.description.map((item, i) => (
                                            <li key={i}>{item}</li>
                                        ))}
                                    </ul>
                                </JobDescription>
                            </TimelineContent>
                        </TimelineItem>
                    ))}
                </Timeline>
            </ExperienceSection>

            <Divider />

            <ExperienceSection>
                <p style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                    Through my professional journey, I've honed my expertise in machine learning, data analysis,
                    and software development. Each role has equipped me with unique skills and perspectives that
                    I bring to every new challenge.
                </p>
            </ExperienceSection>
        </PageContainer>
    );
}

export default ExperiencePage;