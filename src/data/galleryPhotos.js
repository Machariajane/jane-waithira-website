// src/data/galleryPhotos.js
const galleryPhotos = [
    {
        id: 1,
        src: '/images/gallery/travel/Luxembourg.jpg',
        alt: 'Luxembourg',
        title: 'Exploring New Places',
        category: 'travel',
        description: 'My friend Ope took this photo on her pixel 8.'
    },
    {
        id: 2,
        src: '/images/gallery/conference1.jpg',
        alt: 'Data Science Conference',
        title: 'At DSA Conference',
        category: 'professional',
        description: 'Presenting at the Data Science Africa conference in Rwanda.'
    },
    {
        id: 3,
        src: '/images/gallery/hackathon1.jpg',
        alt: 'Hackathon team',
        title: 'Hackathon Victory',
        category: 'professional',
        description: 'Celebrating our top 5 finish at the UbuntuNet Africa Hackathon.'
    },
    {
        id: 4,
        src: '/images/gallery/hobby1.jpg',
        alt: 'Reading time',
        title: 'Weekend Reading',
        category: 'personal',
        description: 'Enjoying a good book on machine learning algorithms.'
    },
    {
        id: 5,
        src: '/images/gallery/food1.jpg',
        alt: 'Local cuisine',
        title: 'Trying Local Cuisine',
        category: 'food',
        description: 'Discovered this amazing restaurant in Nairobi.'
    },
    {
        id: 6,
        src: '/images/gallery/friends1.jpg',
        alt: 'With friends',
        title: 'Good Times with Friends',
        category: 'personal',
        description: 'Weekend hangout with my data science mentoring group.'
    },
    {
        id: 7,
        src: '/images/gallery/nature1.jpg',
        alt: 'Nature photography',
        title: 'Nature Walk',
        category: 'nature',
        description: 'Beautiful sunset during my evening walk.'
    },
    {
        id: 8,
        src: '/images/gallery/workspace1.jpg',
        alt: 'My workspace',
        title: 'My Coding Setup',
        category: 'professional',
        description: 'My home office where the magic happens.'
    }
];

export const categories = [
    { id: 'all', name: 'All Photos', count: galleryPhotos.length },
    { id: 'professional', name: 'Professional', count: galleryPhotos.filter(p => p.category === 'professional').length },
    { id: 'travel', name: 'Travel', count: galleryPhotos.filter(p => p.category === 'travel').length },
    { id: 'personal', name: 'Personal', count: galleryPhotos.filter(p => p.category === 'personal').length },
    { id: 'nature', name: 'Nature', count: galleryPhotos.filter(p => p.category === 'nature').length },
    { id: 'food', name: 'Food', count: galleryPhotos.filter(p => p.category === 'food').length },
    { id: 'hobby', name: 'Hobbies', count: galleryPhotos.filter(p => p.category === 'hobby').length }
];

export default galleryPhotos;