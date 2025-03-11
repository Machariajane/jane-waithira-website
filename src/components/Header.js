// src/components/Header.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  background-color: ${({ theme }) => theme.colors.light};
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: ${({ theme }) => theme.shadows.small};
  position: sticky;
  top: 0;
  z-index: 100;
`;

const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.medium} ${({ theme }) => theme.spacing.large};
  max-width: ${({ theme }) => theme.maxWidth};
  margin: 0 auto;
`;

const Logo = styled(Link)`
  font-family: ${({ theme }) => theme.fonts.heading};
  font-size: 1.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  display: flex;
  align-items: center;
  
  &:before, &:after {
    content: "⚔️";
    font-size: 1.2rem;
    margin: 0 ${({ theme }) => theme.spacing.small};
  }
`;

const Navigation = styled.nav`
  ul {
    display: flex;
    list-style: none;
    
    @media (max-width: 768px) {
      flex-direction: column;
      position: absolute;
      top: 100%;
      right: 0;
      background-color: ${({ theme }) => theme.colors.light};
      width: 200px;
      padding: ${({ theme }) => theme.spacing.medium};
      box-shadow: ${({ theme }) => theme.shadows.medium};
      transform: ${({ isOpen }) => isOpen ? 'translateX(0)' : 'translateX(100%)'};
      transition: transform 0.3s ease;
    }
  }
  
  li {
    margin-left: ${({ theme }) => theme.spacing.large};
    
    @media (max-width: 768px) {
      margin-left: 0;
      margin-bottom: ${({ theme }) => theme.spacing.medium};
    }
  }
  
  a {
    font-family: ${({ theme }) => theme.fonts.heading};
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${({ theme }) => theme.colors.text};
    text-decoration: none;
    transition: color 0.2s ease;
    position: relative;
    
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
    
    &:after {
      content: "";
      position: absolute;
      width: 0;
      height: 2px;
      bottom: -4px;
      left: 0;
      background-color: ${({ theme }) => theme.colors.secondary};
      transition: width 0.3s ease;
    }
    
    &:hover:after {
      width: 100%;
    }
  }
`;

const MenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text};
  
  @media (max-width: 768px) {
    display: block;
  }
`;

function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <HeaderContainer>
            <HeaderContent>
                <Logo to="/">ROMAN CODER</Logo>
                <MenuButton onClick={toggleMenu} aria-label="Toggle menu">
                    ☰
                </MenuButton>
                <Navigation isOpen={isMenuOpen}>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/blog">Articles</Link></li>
                        <li><Link to="/projects">Projects</Link></li>
                        <li><Link to="/about">About</Link></li>
                    </ul>
                </Navigation>
            </HeaderContent>
        </HeaderContainer>
    );
}

export default Header;