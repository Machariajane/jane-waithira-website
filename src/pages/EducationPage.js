// src/pages/EducationPage.js
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

const EducationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing.xlarge};
`;

const EducationCard = styled.div`
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

const CardHeader = styled.div`
  background-color: ${({ theme }) => theme.colors.secondary};
  color: ${({ theme }) => theme.colors.light};
  padding: ${({ theme }) => theme.spacing.large};
  position: relative;
  
  &:after {
    content: "";
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid ${({ theme }) => theme.colors.secondary};
  }
`;

const CardContent = styled.div`
  padding: ${({ theme }) => theme.spacing.large};
`;

const DegreeName = styled.h3`
  font-size: 1.3rem;
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const SchoolName = styled.h4`
  font-size: 1rem;
  text-align: center;
  font-weight: 500;
  margin-bottom: 0;
`;

const GraduationYear = styled.p`
  text-align: center;
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.light};
  opacity: 0.8;
  margin-top: ${({ theme }) => theme.spacing.small};
`;

const CoursesTitle = styled.h4`
  font-size: 1.1rem;
  margin-top: ${({ theme }) => theme.spacing.medium};
  margin-bottom: ${({ theme }) => theme.spacing.small};
  color: ${({ theme }) => theme.colors.primary};
`;

const CoursesList = styled.ul`
  padding-left: 20px;
  
  li {
    margin-bottom: ${({ theme }) => theme.spacing.small};
    font-size: 0.95rem;
  }
`;

const HighlightText = styled.p`
  margin-top: ${({ theme }) => theme.spacing.medium};
  font-style: italic;
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 500;
`;

const CertificationsSection = styled.section`
  margin-top: ${({ theme }) => theme.spacing.xlarge};
`;

const CertificationList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing.large};
`;

const CertificationItem = styled.div`
  background-color: ${({ theme }) => theme.colors.light};
  padding: ${({ theme }) => theme.spacing.large};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ theme }) => theme.shadows.small};
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: ${({ theme }) => theme.shadows.medium};
  }
  
  h3 {
    font-size: 1.2rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};
    color: ${({ theme }) => theme.colors.secondary};
  }
  
  h4 {
    font-size: 1rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};
    font-weight: 500;
  }
  
  p {
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.text};
    font-style: italic;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
  }
  
  ul {
    padding-left: 20px;
    
    li {
      margin-bottom: ${({ theme }) => theme.spacing.small};
      font-size: 0.95rem;
    }
  }
`;

function EducationPage() {
    const education = [
        {
            degree: "BSc. Telecommunications and Information Engineering",
            school: "Jomo Kenyatta University of Agriculture and Technology (JKUAT)",
            location: "Kenya",
            period: "September 2016 – December 2021",
            highlights: [
                "Graduated with First Class Honors",
                "Final year project: Real-time Data on Library Occupancy System"
            ],
            courses: [
                "Statistics",
                "Algebra",
                "Calculus",
                "PDE, ODE, Applied Mathematics",
                "Software Programming",
                "Distributed Systems",
                "Signal Processing"
            ]
        }
    ];

    const certifications = [
        {
            title: "Introduction to Machine Learning with TensorFlow",
            institution: "Udacity",
            period: "March 2023 – present",
            topics: [
                "Supervised learning (Linear Regression, Perceptron Algorithm, Decision Trees, Naive Bayes, SVM, Ensemble Methods)",
                "Deep learning (Neural Networks, Gradient Descent, Deep Learning with TensorFlow, Training, and Tuning)",
                "Unsupervised learning (Clustering, HDBSCAN, GMM, Cluster Validation, Dimensionality Reduction, PCA, Random Projection, and ICA)"
            ]
        },
        {
            title: "Data Analyst Nanodegree",
            institution: "Udacity",
            period: "March 2022 – September 2022",
            topics: [
                "Data analysis process (questioning, wrangling, exploring, analysing, and communicating data using Python)",
                "Applied inferential statistics and probability to real-world scenarios",
                "Data wrangling using Python for preparing data for in-depth analysis",
                "Sound design and data visualisation principles in the data analysis process"
            ]
        }
    ];

    return (
        <PageContainer>
            <PageTitle>Education</PageTitle>

            <EducationGrid>
                {education.map((edu, index) => (
                    <EducationCard key={index}>
                        <CardHeader>
                            <DegreeName>{edu.degree}</DegreeName>
                            <SchoolName>{edu.school}, {edu.location}</SchoolName>
                            <GraduationYear>{edu.period}</GraduationYear>
                        </CardHeader>
                        <CardContent>
                            {edu.highlights.map((highlight, i) => (
                                <HighlightText key={i}>{highlight}</HighlightText>
                            ))}

                            <CoursesTitle>Relevant Coursework</CoursesTitle>
                            <CoursesList>
                                {edu.courses.map((course, i) => (
                                    <li key={i}>{course}</li>
                                ))}
                            </CoursesList>
                        </CardContent>
                    </EducationCard>
                ))}
            </EducationGrid>

            <Divider />

            <CertificationsSection>
                <PageTitle>Certifications & Additional Education</PageTitle>
                <CertificationList>
                    {certifications.map((cert, index) => (
                        <CertificationItem key={index}>
                            <h3>{cert.title}</h3>
                            <h4>{cert.institution}</h4>
                            <p>{cert.period}</p>
                            <ul>
                                {cert.topics.map((topic, i) => (
                                    <li key={i}>{topic}</li>
                                ))}
                            </ul>
                        </CertificationItem>
                    ))}
                </CertificationList>
            </CertificationsSection>

            <Divider />

            <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                <p>
                    My educational background provides a strong foundation in both theoretical concepts and
                    practical applications. I'm committed to continuous learning and regularly pursue additional
                    certifications and courses to stay current with the latest advancements in data science and
                    machine learning.
                </p>
            </div>
        </PageContainer>
    );
}

export default EducationPage;