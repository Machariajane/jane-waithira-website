// src/pages/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import ArticleCard from '../components/ArticleCard';
import RomanDivider from '../components/RomanDivider';
import articles from '../data/articles';

const HeroSection = styled.section`
    height: 70vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: ${({ theme }) => theme.spacing.xlarge};
    background-image: linear-gradient(rgba(245, 245, 220, 0.9), rgba(245, 245, 220, 0.9)),
    url('/images/roman-pattern.png');
    background-size: cover;
    background-position: center;
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

const HeroTitle = styled.h1`
    font-size: 3.5rem;
    margin-bottom: ${({ theme }) => theme.spacing.medium};
    color: ${({ theme }) => theme.colors.primary};
    text-transform: uppercase;
    letter-spacing: 3px;

    span {
        display: block;
        font-size: 1.2rem;
        font-family: ${({ theme }) => theme.fonts.body};
        font-weight: 300;
        text-transform: none;
        letter-spacing: 1px;
        margin-top: ${({ theme }) => theme.spacing.small};
        color: ${({ theme }) => theme.colors.text};
    }
`;

const HeroSubtitle = styled.h2`
    font-size: 1.5rem;
    margin-bottom: ${({ theme }) => theme.spacing.large};
    color: ${({ theme }) => theme.colors.accent};
    font-weight: 400;
    max-width: 700px;
`;

const CtaButton = styled(Link)`
  display: inline-block;
  padding: ${({ theme }) => `${theme.spacing.medium} ${theme.spacing.large}`};
  background-color: ${({ theme, secondary }) => secondary ? 'transparent' : theme.colors.primary};
  color: ${({ theme, secondary }) => secondary ? theme.colors.primary : theme.colors.light};
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  border: 2px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius};
  margin: 0 ${({ theme }) => theme.spacing.small};
  transition: all 0.3s ease;
  text-decoration: none;
  
  &:hover {
    background-color: ${({ theme, secondary }) => secondary ? theme.colors.primary : theme.colors.accent};
    border-color: ${({ theme, secondary }) => secondary ? theme.colors.primary : theme.colors.accent};
    color: ${({ theme }) => theme.colors.light};
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.medium};
  }
`;

const FeaturedSection = styled.section`
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

const ArticlesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing.large};
`;

function HomePage() {
    // Get the 3 most recent articles
    const recentArticles = [...articles].slice(0, 3);

    return (
        <main>
            <HeroSection>
                <HeroTitle>
                    ROMAN CODER
                    <span>Coding with the discipline of a Roman legion</span>
                </HeroTitle>
                <HeroSubtitle>
                    Exploring the intersection of ancient wisdom and modern technology
                </HeroSubtitle>
                <div>
                    <CtaButton to="/blog">Read Articles</CtaButton>
                    <CtaButton to="/about" secondary>About Me</CtaButton>
                </div>
            </HeroSection>

            <FeaturedSection>
                <SectionTitle>Recent Articles</SectionTitle>
                <ArticlesGrid>
                    {recentArticles.map(article => (
                        <ArticleCard key={article.id} article={article} />
                    ))}
                </ArticlesGrid>

                <RomanDivider symbol="⚜" />

                <SectionTitle>About The Author</SectionTitle>
                <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
                    <p>
                        Hello! I'm a developer passionate about creating elegant solutions to complex problems.
                        This blog combines my love for coding with my fascination for Roman history and philosophy.
                        Here, I explore programming concepts through the lens of ancient Roman principles.
                    </p>
                    <CtaButton to="/about" secondary style={{ marginTop: '20px' }}>
                        Learn More
                    </CtaButton>
                </div>
            </FeaturedSection>
        </main>
    );
}

export default HomePage;