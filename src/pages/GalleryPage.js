// src/pages/GalleryPage.js
import React, { useState } from 'react';
import styled from 'styled-components';
import galleryPhotos, { categories } from '../data/galleryPhotos';

const PageContainer = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.xlarge};
`;

const PageTitle = styled.h1`
    text-align: center;
    margin-bottom: ${({ theme }) => theme.spacing.large};
`;

const PageDescription = styled.div`
    text-align: center;
    max-width: 700px;
    margin: 0 auto ${({ theme }) => theme.spacing.xlarge};

    p {
        font-size: 1.1rem;
        line-height: 1.7;
    }
`;

const FilterSection = styled.div`
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.medium};
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const FilterButton = styled.button`
    padding: ${({ theme }) => `${theme.spacing.small} ${theme.spacing.medium}`};
    background-color: ${({ theme, active }) => active ? theme.colors.secondary : 'transparent'};
    color: ${({ theme, active }) => active ? theme.colors.light : theme.colors.text};
    border: 2px solid ${({ theme }) => theme.colors.secondary};
    border-radius: 25px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        background-color: ${({ theme }) => theme.colors.secondary};
        color: ${({ theme }) => theme.colors.light};
        transform: translateY(-2px);
    }
`;

const PhotoGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: ${({ theme }) => theme.spacing.large};
    margin-bottom: ${({ theme }) => theme.spacing.xlarge};
`;

const PhotoCard = styled.div`
    background-color: ${({ theme }) => theme.colors.light};
    border-radius: ${({ theme }) => theme.borderRadius};
    overflow: hidden;
    box-shadow: ${({ theme }) => theme.shadows.medium};
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;

    &:hover {
        transform: translateY(-8px);
        box-shadow: ${({ theme }) => theme.shadows.large};
    }
`;

const PhotoImage = styled.img`
    width: 100%;
    height: 250px;
    object-fit: cover;
    transition: transform 0.3s ease;

    ${PhotoCard}:hover & {
        transform: scale(1.05);
    }
`;

const PhotoInfo = styled.div`
    padding: ${({ theme }) => theme.spacing.medium};
`;

const PhotoTitle = styled.h3`
    font-size: 1.2rem;
    margin-bottom: ${({ theme }) => theme.spacing.small};
    color: ${({ theme }) => theme.colors.primary};
`;

const PhotoCategory = styled.span`
    display: inline-block;
    padding: 2px 8px;
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.secondary};
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
    text-transform: capitalize;
    margin-bottom: ${({ theme }) => theme.spacing.small};
`;

const PhotoDescription = styled.p`
    font-size: 0.9rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.text};
    opacity: 0.8;
`;

// Modal styles
const Modal = styled.div`
    display: ${({ isOpen }) => isOpen ? 'flex' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.9);
    z-index: 1000;
    justify-content: center;
    align-items: center;
    padding: ${({ theme }) => theme.spacing.large};
`;

const ModalContent = styled.div`
    max-width: 90%;
    max-height: 90%;
    position: relative;
`;

const ModalImage = styled.img`
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    border-radius: ${({ theme }) => theme.borderRadius};
`;

const ModalInfo = styled.div`
    background-color: ${({ theme }) => theme.colors.light};
    padding: ${({ theme }) => theme.spacing.medium};
    border-radius: ${({ theme }) => theme.borderRadius};
    margin-top: ${({ theme }) => theme.spacing.medium};
    text-align: center;
`;

const CloseButton = styled.button`
    position: absolute;
    top: -40px;
    right: 0;
    background: none;
    border: none;
    color: white;
    font-size: 2rem;
    cursor: pointer;
    padding: ${({ theme }) => theme.spacing.small};

    &:hover {
        opacity: 0.7;
    }
`;

const NavButton = styled.button`
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background-color: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    font-size: 2rem;
    padding: ${({ theme }) => theme.spacing.medium};
    cursor: pointer;
    border-radius: 50%;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: rgba(255, 255, 255, 0.3);
    }

    left: ${({ direction }) => direction === 'prev' ? '-60px' : 'auto'};
    right: ${({ direction }) => direction === 'next' ? '-60px' : 'auto'};

    @media (max-width: 768px) {
        left: ${({ direction }) => direction === 'prev' ? '10px' : 'auto'};
        right: ${({ direction }) => direction === 'next' ? '10px' : 'auto'};
    }
`;

function GalleryPage() {
    const [activeFilter, setActiveFilter] = useState('all');
    const [modalPhoto, setModalPhoto] = useState(null);
    const [modalIndex, setModalIndex] = useState(0);

    const filteredPhotos = activeFilter === 'all'
        ? galleryPhotos
        : galleryPhotos.filter(photo => photo.category === activeFilter);

    const openModal = (photo) => {
        const index = filteredPhotos.findIndex(p => p.id === photo.id);
        setModalPhoto(photo);
        setModalIndex(index);
    };

    const closeModal = () => {
        setModalPhoto(null);
    };

    const navigateModal = (direction) => {
        const newIndex = direction === 'next'
            ? (modalIndex + 1) % filteredPhotos.length
            : (modalIndex - 1 + filteredPhotos.length) % filteredPhotos.length;

        setModalIndex(newIndex);
        setModalPhoto(filteredPhotos[newIndex]);
    };

    const handleKeyPress = React.useCallback((e) => {
        if (!modalPhoto) return;

        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') navigateModal('prev');
        if (e.key === 'ArrowRight') navigateModal('next');
    }, [modalPhoto, modalIndex, filteredPhotos.length]);

    React.useEffect(() => {
        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);

    return (
        <PageContainer>
            <PageTitle>Photo Gallery</PageTitle>

            <PageDescription>
                <p>
                    Here are some moments that capture who I am beyond the data and code.
                    From professional conferences to personal adventures, these photos tell the story
                    of my journey in tech and life.
                </p>
            </PageDescription>

            <FilterSection>
                {categories.map(category => (
                    <FilterButton
                        key={category.id}
                        active={activeFilter === category.id}
                        onClick={() => setActiveFilter(category.id)}
                    >
                        {category.name} ({category.count})
                    </FilterButton>
                ))}
            </FilterSection>

            <PhotoGrid>
                {filteredPhotos.map(photo => (
                    <PhotoCard key={photo.id} onClick={() => openModal(photo)}>
                        <PhotoImage src={photo.src} alt={photo.alt} />
                        <PhotoInfo>
                            <PhotoCategory>{photo.category}</PhotoCategory>
                            <PhotoTitle>{photo.title}</PhotoTitle>
                            <PhotoDescription>{photo.description}</PhotoDescription>
                        </PhotoInfo>
                    </PhotoCard>
                ))}
            </PhotoGrid>

            {filteredPhotos.length === 0 && (
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                    <p>No photos in this category yet. Check back soon!</p>
                </div>
            )}

            {/* Modal */}
            <Modal isOpen={!!modalPhoto} onClick={closeModal}>
                {modalPhoto && (
                    <ModalContent onClick={(e) => e.stopPropagation()}>
                        <CloseButton onClick={closeModal}>×</CloseButton>

                        {filteredPhotos.length > 1 && (
                            <>
                                <NavButton direction="prev" onClick={() => navigateModal('prev')}>‹</NavButton>
                                <NavButton direction="next" onClick={() => navigateModal('next')}>›</NavButton>
                            </>
                        )}

                        <ModalImage src={modalPhoto.src} alt={modalPhoto.alt} />
                        <ModalInfo>
                            <PhotoCategory>{modalPhoto.category}</PhotoCategory>
                            <PhotoTitle>{modalPhoto.title}</PhotoTitle>
                            <PhotoDescription>{modalPhoto.description}</PhotoDescription>
                        </ModalInfo>
                    </ModalContent>
                )}
            </Modal>
        </PageContainer>
    );
}

export default GalleryPage;