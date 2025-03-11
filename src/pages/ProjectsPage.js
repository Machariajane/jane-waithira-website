// src/pages/ProjectsPage.js
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

const ProjectsSection = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const ProjectsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: ${({ theme }) => theme.spacing.large};
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ProjectCard = styled.div`
  background-color: ${({ theme }) => theme.colors.light};
  border-radius: ${({ theme }) => theme.borderRadius};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.small};
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: ${({ theme }) => theme.shadows.medium};
  }
`;

const ProjectHeader = styled.div`
  padding: ${({ theme }) => theme.spacing.medium};
  background-color: ${({ theme }) => theme.colors.secondary};
  color: ${({ theme }) => theme.colors.light};
`;

const ProjectTitle = styled.h3`
  margin-bottom: 0;
  font-size: 1.2rem;
`;

const ProjectContent = styled.div`
  padding: ${({ theme }) => theme.spacing.large};
  
  p {
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    font-size: 0.95rem;
  }
  
  h4 {
    font-size: 1rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};
    color: ${({ theme }) => theme.colors.primary};
  }
  
  ul {
    padding-left: 20px;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    
    li {
      margin-bottom: ${({ theme }) => theme.spacing.small};
      font-size: 0.9rem;
    }
  }
`;

const AwardSection = styled.section`
  margin-top: ${({ theme }) => theme.spacing.xlarge};
`;

const AwardsList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing.large};
`;

const AwardCard = styled.div`
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
    margin-bottom: ${({ theme }) => theme.spacing.small};
    color: ${({ theme }) => theme.colors.primary};
  }
  
  h4 {
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.secondary};
    margin-bottom: ${({ theme }) => theme.spacing.small};
  }
  
  p {
    font-size: 0.9rem;
    font-style: italic;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.8;
  }
  
  ul {
    padding-left: 20px;
    
    li {
      margin-bottom: ${({ theme }) => theme.spacing.small};
      font-size: 0.95rem;
    }
  }
`;

function ProjectsPage() {
    const projects = [
        {
            title: "Real-time Personalization Engine",
            description: "Led the development of a recommendation system for data offers, serving 5M+ customers.",
            technologies: ["Python", "AWS", "Multi-Armed Bandits", "A/B Testing"],
            achievements: [
                "Designed and implemented a real-time personalization engine",
                "Applied reinforcement learning techniques (Q-learning/MAB)",
                "Conducted A/B tests to assess performance improvements",
                "Generated comprehensive reports for stakeholders"
            ]
        },
        {
            title: "Autonomous Customer Feedback System",
            description: "Developed a GenAI system for analyzing and responding to customer feedback automatically.",
            technologies: ["NLP", "Sentiment Analysis", "Topic Modeling", "Python"],
            achievements: [
                "Integrated GenAI for topic modeling and sentiment analysis",
                "Built an end-to-end system for autonomous responses",
                "Improved Net Promoter Score (NPS)",
                "Reduced manual review time by 70%"
            ]
        },
        {
            title: "Voice Revenue Diagnostics Model",
            description: "Created a causal inference model to identify products impacting voice revenue trends.",
            technologies: ["Causal Graphs", "Python", "Statistical Analysis"],
            achievements: [
                "Developed a diagnostic model using causal graphs",
                "Identified key products affecting revenue trends",
                "Enabled stakeholders to focus on high-impact areas",
                "Presented findings to executive leadership"
            ]
        },
        {
            title: "Retail Footfall Forecasting",
            description: "Collaborated with ML engineers to deploy a time series forecasting model for retail traffic.",
            technologies: ["Prophet", "AWS", "Python", "Time Series Analysis"],
            achievements: [
                "Built a forecasting system for 55 retail stores",
                "Improved staff scheduling efficiency by 15%",
                "Reduced operational costs through optimized resource allocation",
                "Created interactive dashboards for store managers"
            ]
        },
        {
            title: "Customer Segmentation for 5G Acquisition",
            description: "Implemented clustering techniques to identify and target potential 5G customers.",
            technologies: ["PCA", "KMeans", "Python", "SQL"],
            achievements: [
                "Created customer segments based on behavior and demographics",
                "Developed targeting strategies for each segment",
                "Achieved 11% uplift in campaign conversions",
                "Designed a reusable segmentation framework"
            ]
        },
        {
            title: "Phone Upgrade Prediction Model",
            description: "Built a survival model to predict when customers are likely to change phones.",
            technologies: ["Random Survival Forests", "Python", "Statistical Modeling"],
            achievements: [
                "Developed predictive model with 78% accuracy",
                "Created targeted e-commerce campaigns based on predictions",
                "Achieved 100% uplift in month-on-month conversions",
                "Implemented model monitoring and refresh cycle"
            ]
        }
    ];

    const awards = [
        {
            title: "Vodacom/Safaricom Big Data Conference",
            organization: "Vodacom, South Africa",
            date: "October 2023",
            details: [
                "Sponsored attendee at a big data conference and hackathon in Midrand, South Africa",
                "Participated in hackathon challenges including building conversational AI, income prediction modeling, and Battlesnakes competition"
            ]
        },
        {
            title: "UbuntuNet Africa Hackathon and Conference",
            organization: "Uganda",
            date: "October 2023",
            details: [
                "Recognized as one of the top five projects in Africa, selected from over 200 concept papers",
                "Focused on innovation for 21st-century education",
                "Developed skills in writing software requirement specifications and design documents"
            ]
        },
        {
            title: "Data Science Africa (DSA) Summer School",
            organization: "Rwanda",
            date: "May 2023",
            details: [
                "Sponsored participant in a one-week summer school and workshop in Kigali, Rwanda",
                "Theme: 'Harnessing Data Science for Africa's Socio-Economic Development'",
                "Explored deploying machine learning models on edge devices and associated challenges"
            ]
        },
        {
            title: "KamiLimu Outstanding Mentor Award",
            organization: "KamiLimu, Kenya",
            date: "May 2022",
            details: [
                "Recognized as an Outstanding ICT track and Peer Mentor",
                "Successfully mentored 12 beginner students in Data Science",
                "Achieved 100% completion rate with real-world projects"
            ]
        },
        {
            title: "AWS DeepRacer Challenge",
            organization: "Safaricom PLC",
            date: "2022",
            details: [
                "Secured 3rd position in company-wide competition",
                "Trained a reinforcement learning model for autonomous vehicles",
                "Applied practical ML skills in a competitive environment"
            ]
        },
        {
            title: "KamiLimu Job Competition Winner",
            organization: "KamiLimu, Kenya",
            date: "May 2022",
            details: [
                "Winner of the Job Competition in Data Science",
                "Developed an ETA prediction system for motorbike deliveries",
                "Utilized random forest regressor with geographical location data"
            ]
        }
    ];

    return (
        <PageContainer>
            <PageTitle>Projects & Achievements</PageTitle>

            <ProjectsSection>
                <SectionTitle>Key Projects</SectionTitle>
                <ProjectsGrid>
                    {projects.map((project, index) => (
                        <ProjectCard key={index}>
                            <ProjectHeader>
                                <ProjectTitle>{project.title}</ProjectTitle>
                            </ProjectHeader>
                            <ProjectContent>
                                <p>{project.description}</p>
                                <h4>Technologies Used:</h4>
                                <p>{project.technologies.join(", ")}</p>
                                <h4>Achievements:</h4>
                                <ul>
                                    {project.achievements.map((achievement, i) => (
                                        <li key={i}>{achievement}</li>
                                    ))}
                                </ul>
                            </ProjectContent>
                        </ProjectCard>
                    ))}
                </ProjectsGrid>
            </ProjectsSection>

            <Divider />

            <AwardSection>
                <SectionTitle>Awards & Recognition</SectionTitle>
                <AwardsList>
                    {awards.map((award, index) => (
                        <AwardCard key={index}>
                            <h3>{award.title}</h3>
                            <h4>{award.organization}</h4>
                            <p>{award.date}</p>
                            <ul>
                                {award.details.map((detail, i) => (
                                    <li key={i}>{detail}</li>
                                ))}
                            </ul>
                        </AwardCard>
                    ))}
                </AwardsList>
            </AwardSection>

            <Divider />

            <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                <p>
                    These projects and awards represent my commitment to applying data science and machine learning
                    to solve real-world problems. Each project has contributed to my growth as a professional
                    and has allowed me to develop a diverse skill set across different domains and technologies.
                </p>
            </div>
        </PageContainer>
    );
}

export default ProjectsPage;