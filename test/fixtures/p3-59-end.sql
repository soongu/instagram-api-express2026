--
-- PostgreSQL database dump
--

\restrict mAh7sZQPkgow1U3k720oc3YnV4eTE2dO8C6ZZMPJj7XfgnIHumpowjeyCBXF3FM

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'USER',
    'ADMIN'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    post_id integer NOT NULL,
    content text NOT NULL,
    like_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    author_id integer NOT NULL,
    parent_id integer
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: hashtags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hashtags (
    id integer NOT NULL,
    name character varying(30) NOT NULL,
    post_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.hashtags OWNER TO postgres;

--
-- Name: hashtags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hashtags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hashtags_id_seq OWNER TO postgres;

--
-- Name: hashtags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hashtags_id_seq OWNED BY public.hashtags.id;


--
-- Name: post_hashtags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_hashtags (
    id integer NOT NULL,
    post_id integer NOT NULL,
    hashtag_id integer NOT NULL
);


ALTER TABLE public.post_hashtags OWNER TO postgres;

--
-- Name: post_hashtags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_hashtags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_hashtags_id_seq OWNER TO postgres;

--
-- Name: post_hashtags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_hashtags_id_seq OWNED BY public.post_hashtags.id;


--
-- Name: post_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_images (
    id integer NOT NULL,
    post_id integer NOT NULL,
    image_url text NOT NULL,
    img_order integer NOT NULL
);


ALTER TABLE public.post_images OWNER TO postgres;

--
-- Name: post_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_images_id_seq OWNER TO postgres;

--
-- Name: post_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_images_id_seq OWNED BY public.post_images.id;


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_likes (
    id integer NOT NULL,
    post_id integer NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.post_likes OWNER TO postgres;

--
-- Name: post_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_likes_id_seq OWNER TO postgres;

--
-- Name: post_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_likes_id_seq OWNED BY public.post_likes.id;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    post_alt text,
    content text,
    like_count integer DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    author_id integer NOT NULL
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.posts_id_seq OWNER TO postgres;

--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id integer NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    refresh_token_hash text,
    previous_refresh_token_hash text
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: social_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.social_accounts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider character varying(20) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.social_accounts OWNER TO postgres;

--
-- Name: social_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.social_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_accounts_id_seq OWNER TO postgres;

--
-- Name: social_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.social_accounts_id_seq OWNED BY public.social_accounts.id;


--
-- Name: uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.uploads (
    id integer NOT NULL,
    file_name text NOT NULL,
    uploader_id integer NOT NULL,
    post_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    profile_user_id integer
);


ALTER TABLE public.uploads OWNER TO postgres;

--
-- Name: uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.uploads_id_seq OWNER TO postgres;

--
-- Name: uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.uploads_id_seq OWNED BY public.uploads.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    profile_image text,
    deactivated_at timestamp(3) without time zone,
    email character varying(255),
    name character varying(50),
    phone character varying(20),
    password_hash text,
    role public.user_role DEFAULT 'USER'::public.user_role NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: hashtags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hashtags ALTER COLUMN id SET DEFAULT nextval('public.hashtags_id_seq'::regclass);


--
-- Name: post_hashtags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_hashtags ALTER COLUMN id SET DEFAULT nextval('public.post_hashtags_id_seq'::regclass);


--
-- Name: post_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images ALTER COLUMN id SET DEFAULT nextval('public.post_images_id_seq'::regclass);


--
-- Name: post_likes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes ALTER COLUMN id SET DEFAULT nextval('public.post_likes_id_seq'::regclass);


--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);


--
-- Name: social_accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_accounts ALTER COLUMN id SET DEFAULT nextval('public.social_accounts_id_seq'::regclass);


--
-- Name: uploads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads ALTER COLUMN id SET DEFAULT nextval('public.uploads_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public._prisma_migrations VALUES ('21416062-8e95-4d51-baed-fd26354a966c', '5ba9503080ffee5642ff1d3d8b2e82af850939e01d747b3fa9884196a83a1512', '2026-11-24 02:51:26.854127+00', '0_init', NULL, NULL, '2026-11-24 02:51:26.847708+00', 1);
INSERT INTO public._prisma_migrations VALUES ('9260a3ba-8c5a-4123-99fb-d6438938563b', '9be9fb74dc23d62cb8a8122224238f703272a28ef32c07b0da16c543e2ac43c4', '2026-11-24 02:51:55.939276+00', '20261111043902_add_sessions', NULL, NULL, '2026-11-24 02:51:55.933094+00', 1);
INSERT INTO public._prisma_migrations VALUES ('f874bceb-defc-4dcd-a5da-52f0a7449bea', 'cf995a70d480ee2eb7115a0b9d55671962143c19231f1904dc68a26a7c50855f', '2026-11-24 02:51:26.856269+00', '20260930062755_add_updated_at', NULL, NULL, '2026-11-24 02:51:26.854641+00', 1);
INSERT INTO public._prisma_migrations VALUES ('24afd4f7-afe8-4285-85c5-5b2cfcab084d', 'e13735f5c5c65d99b396ab2411a4aea457c9fe1386ad9bee8726b6e1dd7a5216', '2026-11-24 02:51:26.858556+00', '20260930114926_add_comment_updated_at', NULL, NULL, '2026-11-24 02:51:26.856907+00', 1);
INSERT INTO public._prisma_migrations VALUES ('9d475e1e-59b3-4e03-bf65-cb128e378474', '0ea17d1737e689bd072bbefef2168cf362785695e7875b0336356832aa5ceba0', '2026-11-24 02:51:26.867274+00', '20261001120333_normalize_author', NULL, NULL, '2026-11-24 02:51:26.859142+00', 1);
INSERT INTO public._prisma_migrations VALUES ('58070343-13f0-482d-9619-7096c7c0b513', '0fba7837d0760b8757cc3bbd72f6f314d22a5891fb3818b1a3c55dbd46a047b6', '2026-11-24 02:51:59.464467+00', '20261112021830_add_user_role', NULL, NULL, '2026-11-24 02:51:59.46186+00', 1);
INSERT INTO public._prisma_migrations VALUES ('3f3fb238-690f-4dbf-94b3-4f586cd8299c', 'dd70413937b19cfbd342211cda84886ac8a0dbab413795854f7b7027e9d8438a', '2026-11-24 02:51:26.870893+00', '20261001120412_cascade_comments', NULL, NULL, '2026-11-24 02:51:26.867936+00', 1);
INSERT INTO public._prisma_migrations VALUES ('6b974610-a541-4b1f-a559-061dc89802d5', '809dc2b01399d8550505dd8ba2c35f12845e643cd881d57a0f7a3b9b0f53aa41', '2026-11-24 02:51:26.873131+00', '20261001130714_add_user_deactivated_at', NULL, NULL, '2026-11-24 02:51:26.871527+00', 1);
INSERT INTO public._prisma_migrations VALUES ('144933d6-0199-4103-ad59-ab64e9ff2eed', '9e7d9c79e36b6e8d0c0f0cdd994c5fad682c5b6e61e651d2e3083ef04a5dbdf4', '2026-11-24 02:51:26.876944+00', '20261001142735_add_post_images', NULL, NULL, '2026-11-24 02:51:26.873735+00', 1);
INSERT INTO public._prisma_migrations VALUES ('f4581233-8844-48d7-83a1-4625d65c2363', '417e2c7d8807beef3494d98764e887d95ce89db7e130f844e36c8d89cf3d02e6', '2026-11-24 02:52:02.660767+00', '20261112041446_add_refresh_token_hash', NULL, NULL, '2026-11-24 02:52:02.658513+00', 1);
INSERT INTO public._prisma_migrations VALUES ('b7967951-a52b-4fde-939c-8469542e7f9f', '9fd4ebfb7bb7929513f409fd989becb91ab03e7d8505254cf7d5141a2590203a', '2026-11-24 02:51:26.87901+00', '20261001142828_move_images_to_table', NULL, NULL, '2026-11-24 02:51:26.877399+00', 1);
INSERT INTO public._prisma_migrations VALUES ('d55394c7-bf5d-438a-bd8a-f5bd2d7a7add', '19fe2372d537a0c8d91b53aeedadff13570143966459201974b75e496ba20cda', '2026-11-24 02:51:26.881416+00', '20261001143803_add_comment_replies', NULL, NULL, '2026-11-24 02:51:26.879543+00', 1);
INSERT INTO public._prisma_migrations VALUES ('25c4d77f-56b2-4584-97f2-6260aab30c9c', '05bdb9a49f2d7901847812465e519cda10fcfe4d6ed0a2542eab1f1c698311bc', '2026-11-24 02:51:26.88734+00', '20261001144541_add_post_likes', NULL, NULL, '2026-11-24 02:51:26.882063+00', 1);
INSERT INTO public._prisma_migrations VALUES ('9c6810b7-bbff-4580-aba3-32cee2520e98', 'ac2af5db60d0f1edca2099dfa26b70cb3e0a1e2c208d54ad4d0d43b55758a1d6', '2026-11-24 02:52:02.662993+00', '20261112052312_add_previous_refresh_token_hash', NULL, NULL, '2026-11-24 02:52:02.661472+00', 1);
INSERT INTO public._prisma_migrations VALUES ('041f73b6-5ee5-4000-a5b1-73d69f01b9f6', '56cecff481cc785037eff5fde2b7648a3d4bc8840180f30bc4de645c8b359d31', '2026-11-24 02:51:26.889895+00', '20261029031804_add_user_signup_fields', NULL, NULL, '2026-11-24 02:51:26.887761+00', 1);
INSERT INTO public._prisma_migrations VALUES ('7a78dbc7-01b5-4888-9efe-ed0858cc1d35', '48934d46f80650cf0978c749952fa4a746e43bdf0f94713123cc61063720d652', '2026-11-24 02:51:26.892288+00', '20261106135135_add_posts_feed_index', NULL, NULL, '2026-11-24 02:51:26.890377+00', 1);
INSERT INTO public._prisma_migrations VALUES ('f48606dc-b877-4a66-a803-fb232a0db554', 'af69476dd4453323447dd310252e5e80a6977c8f84345a072339e41d4a88fccf', '2026-11-24 02:51:49.441009+00', '20261110042859_add_user_password_hash', NULL, NULL, '2026-11-24 02:51:49.438257+00', 1);
INSERT INTO public._prisma_migrations VALUES ('44439bd4-47e2-406b-99c4-a91b7a2ef502', '9a22402e5595ce15d1eb3d7d17d15813b87079bb481582c5e18f09f98fbbc350', '2026-11-24 02:52:05.703267+00', '20261112075022_add_social_accounts', NULL, NULL, '2026-11-24 02:52:05.697479+00', 1);
INSERT INTO public._prisma_migrations VALUES ('ef3a3dcb-4414-49e9-999f-0ec24dd94b59', 'c36d70b792931a235b869345fc72d256b7fd5ca8c02c714b2cbdf29aeb374c13', '2026-11-24 02:52:10.779654+00', '20261113161034_one_account_per_provider', NULL, NULL, '2026-11-24 02:52:10.776906+00', 1);
INSERT INTO public._prisma_migrations VALUES ('0daeb231-3214-4c1a-ae1e-579e0885a55a', '50f4c03f6987dd1505267a032958871fb84be17903495543e38917c9f7841515', '2026-11-24 02:52:18.708659+00', '20261115064927_add_uploads', NULL, NULL, '2026-11-24 02:52:18.701355+00', 1);
INSERT INTO public._prisma_migrations VALUES ('3b69b60f-1232-46fa-b6db-b030d2507197', 'cf2f05d90b669b5e91f2c949444aa9b0fd671a18faa0b0a62b6e9c5d2fec7774', '2026-11-24 08:17:42.739057+00', '20261124074444_add_hashtags', NULL, NULL, '2026-11-24 08:17:42.73256+00', 1);
INSERT INTO public._prisma_migrations VALUES ('2b1c4ed1-0176-43f4-a317-507591545fbd', 'c3eba21c6b6f00ec4d8330882a8b1de043cb7deb18b20bfacef25abaf29a3979', '2026-11-24 09:45:47.405307+00', '20261124085958_add_post_hashtags_hashtag_id_index', NULL, NULL, '2026-11-24 09:45:47.401409+00', 1);
INSERT INTO public._prisma_migrations VALUES ('97470ea4-94db-4cc2-abd1-9525ad72a462', 'cafb8399ad3325777ddb1c9696efd9c13c00c88038bde98d97baba1f8bc13db3', '2026-11-25 02:21:46.953993+00', '20261125011756_add_upload_profile_user', NULL, NULL, '2026-11-25 02:21:46.943768+00', 1);


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.comments VALUES (1, 1, '저도 가봤어요', 7, '2026-11-24 02:43:27.062', '2026-11-24 02:43:27.062', 3, NULL);
INSERT INTO public.comments VALUES (4, 2, '크루아상 색이 좋네요', 12, '2026-11-24 02:11:27.062', '2026-11-24 02:11:27.062', 2, NULL);
INSERT INTO public.comments VALUES (5, 2, '레시피 공유해주세요', 5, '2026-11-24 02:19:27.062', '2026-11-24 02:19:27.062', 3, NULL);
INSERT INTO public.comments VALUES (6, 2, '저도 구워볼래요', 3, '2026-11-24 02:31:27.062', '2026-11-24 02:31:27.062', 1, NULL);
INSERT INTO public.comments VALUES (7, 2, '냄새가 여기까지', 21, '2026-11-24 02:40:27.062', '2026-11-24 02:40:27.062', 4, NULL);
INSERT INTO public.comments VALUES (8, 3, '다음엔 저도 낄게요', 12, '2026-11-24 00:21:27.062', '2026-11-24 00:21:27.062', 5, NULL);
INSERT INTO public.comments VALUES (9, 3, '코트 어디예요?', 30, '2026-11-24 01:21:27.062', '2026-11-24 01:21:27.062', 1, NULL);
INSERT INTO public.comments VALUES (10, 1, '다음엔 같이 가요', 1, '2026-11-24 02:48:27.067', '2026-11-24 02:48:27.067', 2, 1);
INSERT INTO public.comments VALUES (11, 1, '저도 껴주세요', 0, '2026-11-24 02:49:27.067', '2026-11-24 02:49:27.067', 1, 1);
INSERT INTO public.comments VALUES (12, 2, '이번엔 잘 구워졌어요', 4, '2026-11-24 02:16:27.067', '2026-11-24 02:16:27.067', 3, 4);
INSERT INTO public.comments VALUES (13, 2, '겉이 바삭해 보여요', 0, '2026-11-24 02:28:39.779', '2026-11-24 02:28:39.779', 2, NULL);
INSERT INTO public.comments VALUES (14, 2, '오늘은 버터를 넉넉히 넣었어요', 0, '2026-11-24 02:29:39.779', '2026-11-24 02:29:39.779', 3, NULL);
INSERT INTO public.comments VALUES (15, 2, '반죽은 몇 번 접어요?', 0, '2026-11-24 02:30:39.779', '2026-11-24 02:30:39.779', 1, NULL);
INSERT INTO public.comments VALUES (16, 2, '아침부터 배고파지네요', 0, '2026-11-24 02:31:39.779', '2026-11-24 02:31:39.779', 4, NULL);
INSERT INTO public.comments VALUES (17, 2, '커피랑 같이 먹고 싶어요', 0, '2026-11-24 02:32:39.779', '2026-11-24 02:32:39.779', 5, NULL);
INSERT INTO public.comments VALUES (18, 2, '빵집에서 산 줄 알았어요', 0, '2026-11-24 02:33:39.779', '2026-11-24 02:33:39.779', 6, NULL);
INSERT INTO public.comments VALUES (19, 2, '다음엔 저도 하나 주세요', 0, '2026-11-24 02:34:39.779', '2026-11-24 02:34:39.779', 2, NULL);
INSERT INTO public.comments VALUES (20, 2, '반죽은 세 번 접었어요', 0, '2026-11-24 02:35:39.779', '2026-11-24 02:35:39.779', 3, NULL);
INSERT INTO public.comments VALUES (21, 2, '오븐 온도가 궁금해요', 0, '2026-11-24 02:36:39.779', '2026-11-24 02:36:39.779', 1, NULL);
INSERT INTO public.comments VALUES (22, 2, '사진 색감이 따뜻해요', 0, '2026-11-24 02:37:39.779', '2026-11-24 02:37:39.779', 4, NULL);
INSERT INTO public.comments VALUES (23, 2, '주말에 따라 해 볼게요', 0, '2026-11-24 02:38:39.779', '2026-11-24 02:38:39.779', 5, NULL);
INSERT INTO public.comments VALUES (24, 2, '초코 크루아상도 만들어 주세요', 0, '2026-11-24 02:39:39.779', '2026-11-24 02:39:39.779', 6, NULL);
INSERT INTO public.comments VALUES (25, 2, '보기만 해도 고소해요', 0, '2026-11-24 02:40:39.779', '2026-11-24 02:40:39.779', 2, NULL);
INSERT INTO public.comments VALUES (26, 2, '오븐은 200도로 맞췄어요', 0, '2026-11-24 02:41:39.779', '2026-11-24 02:41:39.779', 3, NULL);
INSERT INTO public.comments VALUES (27, 2, '버터는 어디서 사요?', 0, '2026-11-24 02:42:39.779', '2026-11-24 02:42:39.779', 1, NULL);
INSERT INTO public.comments VALUES (28, 2, '하나만 먹고 끝낼 수 없겠어요', 0, '2026-11-24 02:43:39.779', '2026-11-24 02:43:39.779', 4, NULL);
INSERT INTO public.comments VALUES (29, 2, '몇 개나 구웠어요?', 0, '2026-11-24 02:44:39.779', '2026-11-24 02:44:39.779', 5, NULL);
INSERT INTO public.comments VALUES (30, 2, '속이 촉촉해 보여요', 0, '2026-11-24 02:45:39.779', '2026-11-24 02:45:39.779', 6, NULL);
INSERT INTO public.comments VALUES (31, 2, '저도 오늘 빵 사러 가야겠어요', 0, '2026-11-24 02:46:39.779', '2026-11-24 02:46:39.779', 2, NULL);
INSERT INTO public.comments VALUES (32, 2, '열두 개 구웠어요', 0, '2026-11-24 02:47:39.779', '2026-11-24 02:47:39.779', 3, NULL);
INSERT INTO public.comments VALUES (33, 2, '잼이랑 먹어도 맛있겠어요', 0, '2026-11-24 02:48:39.779', '2026-11-24 02:48:39.779', 1, NULL);
INSERT INTO public.comments VALUES (34, 2, '구운 색이 정말 고르네요', 0, '2026-11-24 02:49:39.779', '2026-11-24 02:49:39.779', 4, NULL);
INSERT INTO public.comments VALUES (35, 2, '다음 빵도 기대할게요', 0, '2026-11-24 02:50:39.779', '2026-11-24 02:50:39.779', 5, NULL);
INSERT INTO public.comments VALUES (36, 2, '저도 굽는 법을 배우고 싶어요', 0, '2026-11-24 02:51:39.779', '2026-11-24 02:51:39.779', 6, NULL);
INSERT INTO public.comments VALUES (37, 2, '아침으로 딱이네요', 0, '2026-11-24 02:52:39.779', '2026-11-24 02:52:39.779', 2, NULL);
INSERT INTO public.comments VALUES (38, 2, '한 입만 나눠 주세요', 0, '2026-11-24 06:13:37.208', '2026-11-24 06:13:37.208', 2, NULL);
INSERT INTO public.comments VALUES (39, 2, '어느 빵집 크루아상이에요?', 0, '2026-11-24 06:13:39.035', '2026-11-24 06:13:39.035', 2, NULL);
INSERT INTO public.comments VALUES (40, 2, '크기가 손바닥만 하네요', 0, '2026-11-24 06:13:39.997', '2026-11-24 06:13:39.997', 2, NULL);
INSERT INTO public.comments VALUES (42, 1, '노을 질 때 가면 더 예뻐요', 0, '2026-11-24 06:13:43.407', '2026-11-24 06:13:43.407', 2, NULL);
INSERT INTO public.comments VALUES (43, 1, '서버가 꺼져 있으면 어떻게 될까요', 0, '2026-11-24 06:13:44.322', '2026-11-24 06:13:44.322', 2, NULL);
INSERT INTO public.comments VALUES (44, 1, '사진은 휴대폰으로 찍었어요', 0, '2026-11-24 06:13:44.502', '2026-11-24 06:13:44.502', 2, NULL);
INSERT INTO public.comments VALUES (45, 2, '저도 주말에 구워 볼게요', 0, '2026-11-24 06:13:44.691', '2026-11-24 06:13:44.691', 2, NULL);
INSERT INTO public.comments VALUES (46, 2, '레시피 꼭 알려 주세요', 0, '2026-11-24 06:13:44.875', '2026-11-24 06:13:44.875', 2, NULL);
INSERT INTO public.comments VALUES (47, 2, '크루아상 모양이 정말 예뻐요', 0, '2026-11-24 06:13:45.048', '2026-11-24 06:13:45.048', 2, NULL);
INSERT INTO public.comments VALUES (48, 2, '한 번에 다 먹을 것 같아요', 0, '2026-11-24 06:13:45.222', '2026-11-24 06:13:45.222', 2, NULL);
INSERT INTO public.comments VALUES (49, 2, '오늘 저녁은 빵으로 정했어요', 0, '2026-11-24 06:13:45.466', '2026-11-24 06:13:45.466', 2, NULL);
INSERT INTO public.comments VALUES (50, 2, '사진만 봐도 배불러요', 0, '2026-11-24 06:13:45.644', '2026-11-24 06:13:45.644', 2, NULL);
INSERT INTO public.comments VALUES (51, 2, '빵 굽는 영상도 올려 주세요', 0, '2026-11-24 06:13:45.82', '2026-11-24 06:13:45.82', 2, NULL);
INSERT INTO public.comments VALUES (53, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 01:28:54.285', '2026-11-24 01:28:54.285', 3, 4);
INSERT INTO public.comments VALUES (54, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 01:29:54.285', '2026-11-24 01:29:54.285', 1, 4);
INSERT INTO public.comments VALUES (55, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 01:30:54.285', '2026-11-24 01:30:54.285', 4, 4);
INSERT INTO public.comments VALUES (56, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 01:31:54.285', '2026-11-24 01:31:54.285', 5, 4);
INSERT INTO public.comments VALUES (58, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 01:33:54.285', '2026-11-24 01:33:54.285', 3, 4);
INSERT INTO public.comments VALUES (59, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 01:34:54.285', '2026-11-24 01:34:54.285', 1, 4);
INSERT INTO public.comments VALUES (60, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 01:35:54.285', '2026-11-24 01:35:54.285', 4, 4);
INSERT INTO public.comments VALUES (61, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 01:36:54.285', '2026-11-24 01:36:54.285', 5, 4);
INSERT INTO public.comments VALUES (62, 2, '다들 같은 생각이네요', 0, '2026-11-24 01:37:54.285', '2026-11-24 01:37:54.285', 2, 4);
INSERT INTO public.comments VALUES (63, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 01:38:54.285', '2026-11-24 01:38:54.285', 3, 4);
INSERT INTO public.comments VALUES (64, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 01:39:54.285', '2026-11-24 01:39:54.285', 1, 4);
INSERT INTO public.comments VALUES (65, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 01:40:54.285', '2026-11-24 01:40:54.285', 4, 4);
INSERT INTO public.comments VALUES (66, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 01:41:54.285', '2026-11-24 01:41:54.285', 5, 4);
INSERT INTO public.comments VALUES (67, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 01:42:54.285', '2026-11-24 01:42:54.285', 2, 4);
INSERT INTO public.comments VALUES (68, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 01:43:54.285', '2026-11-24 01:43:54.285', 3, 4);
INSERT INTO public.comments VALUES (69, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 01:44:54.285', '2026-11-24 01:44:54.285', 1, 4);
INSERT INTO public.comments VALUES (70, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 01:45:54.285', '2026-11-24 01:45:54.285', 4, 4);
INSERT INTO public.comments VALUES (71, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 01:46:54.285', '2026-11-24 01:46:54.285', 5, 4);
INSERT INTO public.comments VALUES (72, 2, '다들 같은 생각이네요', 0, '2026-11-24 01:47:54.285', '2026-11-24 01:47:54.285', 2, 4);
INSERT INTO public.comments VALUES (73, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 01:48:54.285', '2026-11-24 01:48:54.285', 3, 4);
INSERT INTO public.comments VALUES (74, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 01:49:54.285', '2026-11-24 01:49:54.285', 1, 4);
INSERT INTO public.comments VALUES (75, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 01:50:54.285', '2026-11-24 01:50:54.285', 4, 4);
INSERT INTO public.comments VALUES (76, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 01:51:54.285', '2026-11-24 01:51:54.285', 5, 4);
INSERT INTO public.comments VALUES (77, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 01:52:54.285', '2026-11-24 01:52:54.285', 2, 4);
INSERT INTO public.comments VALUES (78, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 01:53:54.285', '2026-11-24 01:53:54.285', 3, 4);
INSERT INTO public.comments VALUES (79, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 01:54:54.285', '2026-11-24 01:54:54.285', 1, 4);
INSERT INTO public.comments VALUES (80, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 01:55:54.285', '2026-11-24 01:55:54.285', 4, 4);
INSERT INTO public.comments VALUES (81, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 01:56:54.285', '2026-11-24 01:56:54.285', 5, 4);
INSERT INTO public.comments VALUES (82, 2, '다들 같은 생각이네요', 0, '2026-11-24 01:57:54.285', '2026-11-24 01:57:54.285', 2, 4);
INSERT INTO public.comments VALUES (83, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 01:58:54.285', '2026-11-24 01:58:54.285', 3, 4);
INSERT INTO public.comments VALUES (84, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 01:59:54.285', '2026-11-24 01:59:54.285', 1, 4);
INSERT INTO public.comments VALUES (85, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 02:00:54.285', '2026-11-24 02:00:54.285', 4, 4);
INSERT INTO public.comments VALUES (86, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 02:01:54.285', '2026-11-24 02:01:54.285', 5, 4);
INSERT INTO public.comments VALUES (87, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 02:02:54.285', '2026-11-24 02:02:54.285', 2, 4);
INSERT INTO public.comments VALUES (88, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 02:03:54.285', '2026-11-24 02:03:54.285', 3, 4);
INSERT INTO public.comments VALUES (89, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 02:04:54.285', '2026-11-24 02:04:54.285', 1, 4);
INSERT INTO public.comments VALUES (90, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 02:05:54.285', '2026-11-24 02:05:54.285', 4, 4);
INSERT INTO public.comments VALUES (91, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 02:06:54.285', '2026-11-24 02:06:54.285', 5, 4);
INSERT INTO public.comments VALUES (92, 2, '다들 같은 생각이네요', 0, '2026-11-24 02:07:54.285', '2026-11-24 02:07:54.285', 2, 4);
INSERT INTO public.comments VALUES (93, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 02:08:54.285', '2026-11-24 02:08:54.285', 3, 4);
INSERT INTO public.comments VALUES (94, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 02:09:54.285', '2026-11-24 02:09:54.285', 1, 4);
INSERT INTO public.comments VALUES (95, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 02:10:54.285', '2026-11-24 02:10:54.285', 4, 4);
INSERT INTO public.comments VALUES (96, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 02:11:54.285', '2026-11-24 02:11:54.285', 5, 4);
INSERT INTO public.comments VALUES (97, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 02:12:54.285', '2026-11-24 02:12:54.285', 2, 4);
INSERT INTO public.comments VALUES (98, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 02:13:54.285', '2026-11-24 02:13:54.285', 3, 4);
INSERT INTO public.comments VALUES (99, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 02:14:54.285', '2026-11-24 02:14:54.285', 1, 4);
INSERT INTO public.comments VALUES (100, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 02:15:54.285', '2026-11-24 02:15:54.285', 4, 4);
INSERT INTO public.comments VALUES (101, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 02:16:54.285', '2026-11-24 02:16:54.285', 5, 4);
INSERT INTO public.comments VALUES (102, 2, '다들 같은 생각이네요', 0, '2026-11-24 02:17:54.285', '2026-11-24 02:17:54.285', 2, 4);
INSERT INTO public.comments VALUES (103, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 02:18:54.285', '2026-11-24 02:18:54.285', 3, 4);
INSERT INTO public.comments VALUES (104, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 02:19:54.285', '2026-11-24 02:19:54.285', 1, 4);
INSERT INTO public.comments VALUES (105, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 02:20:54.285', '2026-11-24 02:20:54.285', 4, 4);
INSERT INTO public.comments VALUES (106, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 02:21:54.285', '2026-11-24 02:21:54.285', 5, 4);
INSERT INTO public.comments VALUES (107, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 02:22:54.285', '2026-11-24 02:22:54.285', 2, 4);
INSERT INTO public.comments VALUES (108, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 02:23:54.285', '2026-11-24 02:23:54.285', 3, 4);
INSERT INTO public.comments VALUES (109, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 02:24:54.285', '2026-11-24 02:24:54.285', 1, 4);
INSERT INTO public.comments VALUES (110, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 02:25:54.285', '2026-11-24 02:25:54.285', 4, 4);
INSERT INTO public.comments VALUES (111, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 02:26:54.285', '2026-11-24 02:26:54.285', 5, 4);
INSERT INTO public.comments VALUES (112, 2, '다들 같은 생각이네요', 0, '2026-11-24 02:27:54.285', '2026-11-24 02:27:54.285', 2, 4);
INSERT INTO public.comments VALUES (113, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 02:28:54.285', '2026-11-24 02:28:54.285', 3, 4);
INSERT INTO public.comments VALUES (114, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 02:29:54.285', '2026-11-24 02:29:54.285', 1, 4);
INSERT INTO public.comments VALUES (115, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 02:30:54.285', '2026-11-24 02:30:54.285', 4, 4);
INSERT INTO public.comments VALUES (116, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 02:31:54.285', '2026-11-24 02:31:54.285', 5, 4);
INSERT INTO public.comments VALUES (117, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 02:32:54.285', '2026-11-24 02:32:54.285', 2, 4);
INSERT INTO public.comments VALUES (118, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 02:33:54.285', '2026-11-24 02:33:54.285', 3, 4);
INSERT INTO public.comments VALUES (119, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 02:34:54.285', '2026-11-24 02:34:54.285', 1, 4);
INSERT INTO public.comments VALUES (120, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 02:35:54.285', '2026-11-24 02:35:54.285', 4, 4);
INSERT INTO public.comments VALUES (121, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 02:36:54.285', '2026-11-24 02:36:54.285', 5, 4);
INSERT INTO public.comments VALUES (122, 2, '다들 같은 생각이네요', 0, '2026-11-24 02:37:54.285', '2026-11-24 02:37:54.285', 2, 4);
INSERT INTO public.comments VALUES (123, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 02:38:54.285', '2026-11-24 02:38:54.285', 3, 4);
INSERT INTO public.comments VALUES (124, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 02:39:54.285', '2026-11-24 02:39:54.285', 1, 4);
INSERT INTO public.comments VALUES (125, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 02:40:54.285', '2026-11-24 02:40:54.285', 4, 4);
INSERT INTO public.comments VALUES (126, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 02:41:54.285', '2026-11-24 02:41:54.285', 5, 4);
INSERT INTO public.comments VALUES (127, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 02:42:54.285', '2026-11-24 02:42:54.285', 2, 4);
INSERT INTO public.comments VALUES (128, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 02:43:54.285', '2026-11-24 02:43:54.285', 3, 4);
INSERT INTO public.comments VALUES (129, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 02:44:54.285', '2026-11-24 02:44:54.285', 1, 4);
INSERT INTO public.comments VALUES (130, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 02:45:54.285', '2026-11-24 02:45:54.285', 4, 4);
INSERT INTO public.comments VALUES (131, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 02:46:54.285', '2026-11-24 02:46:54.285', 5, 4);
INSERT INTO public.comments VALUES (132, 2, '다들 같은 생각이네요', 0, '2026-11-24 02:47:54.285', '2026-11-24 02:47:54.285', 2, 4);
INSERT INTO public.comments VALUES (133, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 02:48:54.285', '2026-11-24 02:48:54.285', 3, 4);
INSERT INTO public.comments VALUES (134, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 02:49:54.285', '2026-11-24 02:49:54.285', 1, 4);
INSERT INTO public.comments VALUES (135, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 02:50:54.285', '2026-11-24 02:50:54.285', 4, 4);
INSERT INTO public.comments VALUES (136, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 02:51:54.285', '2026-11-24 02:51:54.285', 5, 4);
INSERT INTO public.comments VALUES (137, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 02:52:54.285', '2026-11-24 02:52:54.285', 2, 4);
INSERT INTO public.comments VALUES (138, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 02:53:54.285', '2026-11-24 02:53:54.285', 3, 4);
INSERT INTO public.comments VALUES (139, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 02:54:54.285', '2026-11-24 02:54:54.285', 1, 4);
INSERT INTO public.comments VALUES (140, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 02:55:54.285', '2026-11-24 02:55:54.285', 4, 4);
INSERT INTO public.comments VALUES (141, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 02:56:54.285', '2026-11-24 02:56:54.285', 5, 4);
INSERT INTO public.comments VALUES (142, 2, '다들 같은 생각이네요', 0, '2026-11-24 02:57:54.285', '2026-11-24 02:57:54.285', 2, 4);
INSERT INTO public.comments VALUES (143, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 02:58:54.285', '2026-11-24 02:58:54.285', 3, 4);
INSERT INTO public.comments VALUES (144, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 02:59:54.285', '2026-11-24 02:59:54.285', 1, 4);
INSERT INTO public.comments VALUES (145, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 03:00:54.285', '2026-11-24 03:00:54.285', 4, 4);
INSERT INTO public.comments VALUES (146, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 03:01:54.285', '2026-11-24 03:01:54.285', 5, 4);
INSERT INTO public.comments VALUES (147, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 03:02:54.285', '2026-11-24 03:02:54.285', 2, 4);
INSERT INTO public.comments VALUES (148, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 03:03:54.285', '2026-11-24 03:03:54.285', 3, 4);
INSERT INTO public.comments VALUES (149, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 03:04:54.285', '2026-11-24 03:04:54.285', 1, 4);
INSERT INTO public.comments VALUES (150, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 03:05:54.285', '2026-11-24 03:05:54.285', 4, 4);
INSERT INTO public.comments VALUES (151, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 03:06:54.285', '2026-11-24 03:06:54.285', 5, 4);
INSERT INTO public.comments VALUES (152, 2, '다들 같은 생각이네요', 0, '2026-11-24 03:07:54.285', '2026-11-24 03:07:54.285', 2, 4);
INSERT INTO public.comments VALUES (153, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 03:08:54.285', '2026-11-24 03:08:54.285', 3, 4);
INSERT INTO public.comments VALUES (154, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 03:09:54.285', '2026-11-24 03:09:54.285', 1, 4);
INSERT INTO public.comments VALUES (155, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 03:10:54.285', '2026-11-24 03:10:54.285', 4, 4);
INSERT INTO public.comments VALUES (156, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 03:11:54.285', '2026-11-24 03:11:54.285', 5, 4);
INSERT INTO public.comments VALUES (157, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 03:12:54.285', '2026-11-24 03:12:54.285', 2, 4);
INSERT INTO public.comments VALUES (235, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 04:30:54.285', '2026-11-24 04:30:54.285', 4, 4);
INSERT INTO public.comments VALUES (158, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 03:13:54.285', '2026-11-24 03:13:54.285', 3, 4);
INSERT INTO public.comments VALUES (159, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 03:14:54.285', '2026-11-24 03:14:54.285', 1, 4);
INSERT INTO public.comments VALUES (160, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 03:15:54.285', '2026-11-24 03:15:54.285', 4, 4);
INSERT INTO public.comments VALUES (161, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 03:16:54.285', '2026-11-24 03:16:54.285', 5, 4);
INSERT INTO public.comments VALUES (162, 2, '다들 같은 생각이네요', 0, '2026-11-24 03:17:54.285', '2026-11-24 03:17:54.285', 2, 4);
INSERT INTO public.comments VALUES (163, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 03:18:54.285', '2026-11-24 03:18:54.285', 3, 4);
INSERT INTO public.comments VALUES (164, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 03:19:54.285', '2026-11-24 03:19:54.285', 1, 4);
INSERT INTO public.comments VALUES (165, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 03:20:54.285', '2026-11-24 03:20:54.285', 4, 4);
INSERT INTO public.comments VALUES (166, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 03:21:54.285', '2026-11-24 03:21:54.285', 5, 4);
INSERT INTO public.comments VALUES (167, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 03:22:54.285', '2026-11-24 03:22:54.285', 2, 4);
INSERT INTO public.comments VALUES (168, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 03:23:54.285', '2026-11-24 03:23:54.285', 3, 4);
INSERT INTO public.comments VALUES (169, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 03:24:54.285', '2026-11-24 03:24:54.285', 1, 4);
INSERT INTO public.comments VALUES (170, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 03:25:54.285', '2026-11-24 03:25:54.285', 4, 4);
INSERT INTO public.comments VALUES (171, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 03:26:54.285', '2026-11-24 03:26:54.285', 5, 4);
INSERT INTO public.comments VALUES (172, 2, '다들 같은 생각이네요', 0, '2026-11-24 03:27:54.285', '2026-11-24 03:27:54.285', 2, 4);
INSERT INTO public.comments VALUES (173, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 03:28:54.285', '2026-11-24 03:28:54.285', 3, 4);
INSERT INTO public.comments VALUES (174, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 03:29:54.285', '2026-11-24 03:29:54.285', 1, 4);
INSERT INTO public.comments VALUES (175, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 03:30:54.285', '2026-11-24 03:30:54.285', 4, 4);
INSERT INTO public.comments VALUES (176, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 03:31:54.285', '2026-11-24 03:31:54.285', 5, 4);
INSERT INTO public.comments VALUES (177, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 03:32:54.285', '2026-11-24 03:32:54.285', 2, 4);
INSERT INTO public.comments VALUES (178, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 03:33:54.285', '2026-11-24 03:33:54.285', 3, 4);
INSERT INTO public.comments VALUES (179, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 03:34:54.285', '2026-11-24 03:34:54.285', 1, 4);
INSERT INTO public.comments VALUES (180, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 03:35:54.285', '2026-11-24 03:35:54.285', 4, 4);
INSERT INTO public.comments VALUES (181, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 03:36:54.285', '2026-11-24 03:36:54.285', 5, 4);
INSERT INTO public.comments VALUES (182, 2, '다들 같은 생각이네요', 0, '2026-11-24 03:37:54.285', '2026-11-24 03:37:54.285', 2, 4);
INSERT INTO public.comments VALUES (183, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 03:38:54.285', '2026-11-24 03:38:54.285', 3, 4);
INSERT INTO public.comments VALUES (184, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 03:39:54.285', '2026-11-24 03:39:54.285', 1, 4);
INSERT INTO public.comments VALUES (185, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 03:40:54.285', '2026-11-24 03:40:54.285', 4, 4);
INSERT INTO public.comments VALUES (186, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 03:41:54.285', '2026-11-24 03:41:54.285', 5, 4);
INSERT INTO public.comments VALUES (187, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 03:42:54.285', '2026-11-24 03:42:54.285', 2, 4);
INSERT INTO public.comments VALUES (188, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 03:43:54.285', '2026-11-24 03:43:54.285', 3, 4);
INSERT INTO public.comments VALUES (189, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 03:44:54.285', '2026-11-24 03:44:54.285', 1, 4);
INSERT INTO public.comments VALUES (190, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 03:45:54.285', '2026-11-24 03:45:54.285', 4, 4);
INSERT INTO public.comments VALUES (191, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 03:46:54.285', '2026-11-24 03:46:54.285', 5, 4);
INSERT INTO public.comments VALUES (192, 2, '다들 같은 생각이네요', 0, '2026-11-24 03:47:54.285', '2026-11-24 03:47:54.285', 2, 4);
INSERT INTO public.comments VALUES (193, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 03:48:54.285', '2026-11-24 03:48:54.285', 3, 4);
INSERT INTO public.comments VALUES (194, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 03:49:54.285', '2026-11-24 03:49:54.285', 1, 4);
INSERT INTO public.comments VALUES (195, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 03:50:54.285', '2026-11-24 03:50:54.285', 4, 4);
INSERT INTO public.comments VALUES (196, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 03:51:54.285', '2026-11-24 03:51:54.285', 5, 4);
INSERT INTO public.comments VALUES (197, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 03:52:54.285', '2026-11-24 03:52:54.285', 2, 4);
INSERT INTO public.comments VALUES (198, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 03:53:54.285', '2026-11-24 03:53:54.285', 3, 4);
INSERT INTO public.comments VALUES (199, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 03:54:54.285', '2026-11-24 03:54:54.285', 1, 4);
INSERT INTO public.comments VALUES (200, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 03:55:54.285', '2026-11-24 03:55:54.285', 4, 4);
INSERT INTO public.comments VALUES (201, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 03:56:54.285', '2026-11-24 03:56:54.285', 5, 4);
INSERT INTO public.comments VALUES (202, 2, '다들 같은 생각이네요', 0, '2026-11-24 03:57:54.285', '2026-11-24 03:57:54.285', 2, 4);
INSERT INTO public.comments VALUES (203, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 03:58:54.285', '2026-11-24 03:58:54.285', 3, 4);
INSERT INTO public.comments VALUES (204, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 03:59:54.285', '2026-11-24 03:59:54.285', 1, 4);
INSERT INTO public.comments VALUES (205, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 04:00:54.285', '2026-11-24 04:00:54.285', 4, 4);
INSERT INTO public.comments VALUES (206, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 04:01:54.285', '2026-11-24 04:01:54.285', 5, 4);
INSERT INTO public.comments VALUES (207, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 04:02:54.285', '2026-11-24 04:02:54.285', 2, 4);
INSERT INTO public.comments VALUES (208, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 04:03:54.285', '2026-11-24 04:03:54.285', 3, 4);
INSERT INTO public.comments VALUES (209, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 04:04:54.285', '2026-11-24 04:04:54.285', 1, 4);
INSERT INTO public.comments VALUES (210, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 04:05:54.285', '2026-11-24 04:05:54.285', 4, 4);
INSERT INTO public.comments VALUES (211, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 04:06:54.285', '2026-11-24 04:06:54.285', 5, 4);
INSERT INTO public.comments VALUES (212, 2, '다들 같은 생각이네요', 0, '2026-11-24 04:07:54.285', '2026-11-24 04:07:54.285', 2, 4);
INSERT INTO public.comments VALUES (213, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 04:08:54.285', '2026-11-24 04:08:54.285', 3, 4);
INSERT INTO public.comments VALUES (214, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 04:09:54.285', '2026-11-24 04:09:54.285', 1, 4);
INSERT INTO public.comments VALUES (215, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 04:10:54.285', '2026-11-24 04:10:54.285', 4, 4);
INSERT INTO public.comments VALUES (216, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 04:11:54.285', '2026-11-24 04:11:54.285', 5, 4);
INSERT INTO public.comments VALUES (217, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 04:12:54.285', '2026-11-24 04:12:54.285', 2, 4);
INSERT INTO public.comments VALUES (218, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 04:13:54.285', '2026-11-24 04:13:54.285', 3, 4);
INSERT INTO public.comments VALUES (219, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 04:14:54.285', '2026-11-24 04:14:54.285', 1, 4);
INSERT INTO public.comments VALUES (220, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 04:15:54.285', '2026-11-24 04:15:54.285', 4, 4);
INSERT INTO public.comments VALUES (221, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 04:16:54.285', '2026-11-24 04:16:54.285', 5, 4);
INSERT INTO public.comments VALUES (222, 2, '다들 같은 생각이네요', 0, '2026-11-24 04:17:54.285', '2026-11-24 04:17:54.285', 2, 4);
INSERT INTO public.comments VALUES (223, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 04:18:54.285', '2026-11-24 04:18:54.285', 3, 4);
INSERT INTO public.comments VALUES (224, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 04:19:54.285', '2026-11-24 04:19:54.285', 1, 4);
INSERT INTO public.comments VALUES (225, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 04:20:54.285', '2026-11-24 04:20:54.285', 4, 4);
INSERT INTO public.comments VALUES (226, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 04:21:54.285', '2026-11-24 04:21:54.285', 5, 4);
INSERT INTO public.comments VALUES (227, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 04:22:54.285', '2026-11-24 04:22:54.285', 2, 4);
INSERT INTO public.comments VALUES (228, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 04:23:54.285', '2026-11-24 04:23:54.285', 3, 4);
INSERT INTO public.comments VALUES (229, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 04:24:54.285', '2026-11-24 04:24:54.285', 1, 4);
INSERT INTO public.comments VALUES (230, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 04:25:54.285', '2026-11-24 04:25:54.285', 4, 4);
INSERT INTO public.comments VALUES (231, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 04:26:54.285', '2026-11-24 04:26:54.285', 5, 4);
INSERT INTO public.comments VALUES (232, 2, '다들 같은 생각이네요', 0, '2026-11-24 04:27:54.285', '2026-11-24 04:27:54.285', 2, 4);
INSERT INTO public.comments VALUES (233, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 04:28:54.285', '2026-11-24 04:28:54.285', 3, 4);
INSERT INTO public.comments VALUES (234, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 04:29:54.285', '2026-11-24 04:29:54.285', 1, 4);
INSERT INTO public.comments VALUES (236, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 04:31:54.285', '2026-11-24 04:31:54.285', 5, 4);
INSERT INTO public.comments VALUES (237, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 04:32:54.285', '2026-11-24 04:32:54.285', 2, 4);
INSERT INTO public.comments VALUES (238, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 04:33:54.285', '2026-11-24 04:33:54.285', 3, 4);
INSERT INTO public.comments VALUES (239, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 04:34:54.285', '2026-11-24 04:34:54.285', 1, 4);
INSERT INTO public.comments VALUES (240, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 04:35:54.285', '2026-11-24 04:35:54.285', 4, 4);
INSERT INTO public.comments VALUES (241, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 04:36:54.285', '2026-11-24 04:36:54.285', 5, 4);
INSERT INTO public.comments VALUES (242, 2, '다들 같은 생각이네요', 0, '2026-11-24 04:37:54.285', '2026-11-24 04:37:54.285', 2, 4);
INSERT INTO public.comments VALUES (243, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 04:38:54.285', '2026-11-24 04:38:54.285', 3, 4);
INSERT INTO public.comments VALUES (244, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 04:39:54.285', '2026-11-24 04:39:54.285', 1, 4);
INSERT INTO public.comments VALUES (245, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 04:40:54.285', '2026-11-24 04:40:54.285', 4, 4);
INSERT INTO public.comments VALUES (246, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 04:41:54.285', '2026-11-24 04:41:54.285', 5, 4);
INSERT INTO public.comments VALUES (247, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 04:42:54.285', '2026-11-24 04:42:54.285', 2, 4);
INSERT INTO public.comments VALUES (248, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 04:43:54.285', '2026-11-24 04:43:54.285', 3, 4);
INSERT INTO public.comments VALUES (249, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 04:44:54.285', '2026-11-24 04:44:54.285', 1, 4);
INSERT INTO public.comments VALUES (250, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 04:45:54.285', '2026-11-24 04:45:54.285', 4, 4);
INSERT INTO public.comments VALUES (251, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 04:46:54.285', '2026-11-24 04:46:54.285', 5, 4);
INSERT INTO public.comments VALUES (252, 2, '다들 같은 생각이네요', 0, '2026-11-24 04:47:54.285', '2026-11-24 04:47:54.285', 2, 4);
INSERT INTO public.comments VALUES (253, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 04:48:54.285', '2026-11-24 04:48:54.285', 3, 4);
INSERT INTO public.comments VALUES (254, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 04:49:54.285', '2026-11-24 04:49:54.285', 1, 4);
INSERT INTO public.comments VALUES (255, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 04:50:54.285', '2026-11-24 04:50:54.285', 4, 4);
INSERT INTO public.comments VALUES (256, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 04:51:54.285', '2026-11-24 04:51:54.285', 5, 4);
INSERT INTO public.comments VALUES (257, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 04:52:54.285', '2026-11-24 04:52:54.285', 2, 4);
INSERT INTO public.comments VALUES (258, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 04:53:54.285', '2026-11-24 04:53:54.285', 3, 4);
INSERT INTO public.comments VALUES (259, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 04:54:54.285', '2026-11-24 04:54:54.285', 1, 4);
INSERT INTO public.comments VALUES (260, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 04:55:54.285', '2026-11-24 04:55:54.285', 4, 4);
INSERT INTO public.comments VALUES (261, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 04:56:54.285', '2026-11-24 04:56:54.285', 5, 4);
INSERT INTO public.comments VALUES (262, 2, '다들 같은 생각이네요', 0, '2026-11-24 04:57:54.285', '2026-11-24 04:57:54.285', 2, 4);
INSERT INTO public.comments VALUES (263, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 04:58:54.285', '2026-11-24 04:58:54.285', 3, 4);
INSERT INTO public.comments VALUES (264, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 04:59:54.285', '2026-11-24 04:59:54.285', 1, 4);
INSERT INTO public.comments VALUES (265, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 05:00:54.285', '2026-11-24 05:00:54.285', 4, 4);
INSERT INTO public.comments VALUES (266, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 05:01:54.285', '2026-11-24 05:01:54.285', 5, 4);
INSERT INTO public.comments VALUES (267, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 05:02:54.285', '2026-11-24 05:02:54.285', 2, 4);
INSERT INTO public.comments VALUES (268, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 05:03:54.285', '2026-11-24 05:03:54.285', 3, 4);
INSERT INTO public.comments VALUES (269, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 05:04:54.285', '2026-11-24 05:04:54.285', 1, 4);
INSERT INTO public.comments VALUES (270, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 05:05:54.285', '2026-11-24 05:05:54.285', 4, 4);
INSERT INTO public.comments VALUES (271, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 05:06:54.285', '2026-11-24 05:06:54.285', 5, 4);
INSERT INTO public.comments VALUES (272, 2, '다들 같은 생각이네요', 0, '2026-11-24 05:07:54.285', '2026-11-24 05:07:54.285', 2, 4);
INSERT INTO public.comments VALUES (273, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 05:08:54.285', '2026-11-24 05:08:54.285', 3, 4);
INSERT INTO public.comments VALUES (274, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 05:09:54.285', '2026-11-24 05:09:54.285', 1, 4);
INSERT INTO public.comments VALUES (275, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 05:10:54.285', '2026-11-24 05:10:54.285', 4, 4);
INSERT INTO public.comments VALUES (276, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 05:11:54.285', '2026-11-24 05:11:54.285', 5, 4);
INSERT INTO public.comments VALUES (277, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 05:12:54.285', '2026-11-24 05:12:54.285', 2, 4);
INSERT INTO public.comments VALUES (278, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 05:13:54.285', '2026-11-24 05:13:54.285', 3, 4);
INSERT INTO public.comments VALUES (279, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 05:14:54.285', '2026-11-24 05:14:54.285', 1, 4);
INSERT INTO public.comments VALUES (280, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 05:15:54.285', '2026-11-24 05:15:54.285', 4, 4);
INSERT INTO public.comments VALUES (281, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 05:16:54.285', '2026-11-24 05:16:54.285', 5, 4);
INSERT INTO public.comments VALUES (282, 2, '다들 같은 생각이네요', 0, '2026-11-24 05:17:54.285', '2026-11-24 05:17:54.285', 2, 4);
INSERT INTO public.comments VALUES (283, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 05:18:54.285', '2026-11-24 05:18:54.285', 3, 4);
INSERT INTO public.comments VALUES (284, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 05:19:54.285', '2026-11-24 05:19:54.285', 1, 4);
INSERT INTO public.comments VALUES (285, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 05:20:54.285', '2026-11-24 05:20:54.285', 4, 4);
INSERT INTO public.comments VALUES (286, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 05:21:54.285', '2026-11-24 05:21:54.285', 5, 4);
INSERT INTO public.comments VALUES (287, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 05:22:54.285', '2026-11-24 05:22:54.285', 2, 4);
INSERT INTO public.comments VALUES (288, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 05:23:54.285', '2026-11-24 05:23:54.285', 3, 4);
INSERT INTO public.comments VALUES (289, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 05:24:54.285', '2026-11-24 05:24:54.285', 1, 4);
INSERT INTO public.comments VALUES (290, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 05:25:54.285', '2026-11-24 05:25:54.285', 4, 4);
INSERT INTO public.comments VALUES (291, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 05:26:54.285', '2026-11-24 05:26:54.285', 5, 4);
INSERT INTO public.comments VALUES (292, 2, '다들 같은 생각이네요', 0, '2026-11-24 05:27:54.285', '2026-11-24 05:27:54.285', 2, 4);
INSERT INTO public.comments VALUES (293, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 05:28:54.285', '2026-11-24 05:28:54.285', 3, 4);
INSERT INTO public.comments VALUES (294, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 05:29:54.285', '2026-11-24 05:29:54.285', 1, 4);
INSERT INTO public.comments VALUES (295, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 05:30:54.285', '2026-11-24 05:30:54.285', 4, 4);
INSERT INTO public.comments VALUES (296, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 05:31:54.285', '2026-11-24 05:31:54.285', 5, 4);
INSERT INTO public.comments VALUES (297, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 05:32:54.285', '2026-11-24 05:32:54.285', 2, 4);
INSERT INTO public.comments VALUES (298, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 05:33:54.285', '2026-11-24 05:33:54.285', 3, 4);
INSERT INTO public.comments VALUES (299, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 05:34:54.285', '2026-11-24 05:34:54.285', 1, 4);
INSERT INTO public.comments VALUES (300, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 05:35:54.285', '2026-11-24 05:35:54.285', 4, 4);
INSERT INTO public.comments VALUES (301, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 05:36:54.285', '2026-11-24 05:36:54.285', 5, 4);
INSERT INTO public.comments VALUES (302, 2, '다들 같은 생각이네요', 0, '2026-11-24 05:37:54.285', '2026-11-24 05:37:54.285', 2, 4);
INSERT INTO public.comments VALUES (303, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 05:38:54.285', '2026-11-24 05:38:54.285', 3, 4);
INSERT INTO public.comments VALUES (304, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 05:39:54.285', '2026-11-24 05:39:54.285', 1, 4);
INSERT INTO public.comments VALUES (305, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 05:40:54.285', '2026-11-24 05:40:54.285', 4, 4);
INSERT INTO public.comments VALUES (306, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 05:41:54.285', '2026-11-24 05:41:54.285', 5, 4);
INSERT INTO public.comments VALUES (307, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 05:42:54.285', '2026-11-24 05:42:54.285', 2, 4);
INSERT INTO public.comments VALUES (308, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 05:43:54.285', '2026-11-24 05:43:54.285', 3, 4);
INSERT INTO public.comments VALUES (309, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 05:44:54.285', '2026-11-24 05:44:54.285', 1, 4);
INSERT INTO public.comments VALUES (310, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 05:45:54.285', '2026-11-24 05:45:54.285', 4, 4);
INSERT INTO public.comments VALUES (311, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 05:46:54.285', '2026-11-24 05:46:54.285', 5, 4);
INSERT INTO public.comments VALUES (312, 2, '다들 같은 생각이네요', 0, '2026-11-24 05:47:54.285', '2026-11-24 05:47:54.285', 2, 4);
INSERT INTO public.comments VALUES (313, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 05:48:54.285', '2026-11-24 05:48:54.285', 3, 4);
INSERT INTO public.comments VALUES (314, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 05:49:54.285', '2026-11-24 05:49:54.285', 1, 4);
INSERT INTO public.comments VALUES (315, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 05:50:54.285', '2026-11-24 05:50:54.285', 4, 4);
INSERT INTO public.comments VALUES (316, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 05:51:54.285', '2026-11-24 05:51:54.285', 5, 4);
INSERT INTO public.comments VALUES (317, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 05:52:54.285', '2026-11-24 05:52:54.285', 2, 4);
INSERT INTO public.comments VALUES (318, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 05:53:54.285', '2026-11-24 05:53:54.285', 3, 4);
INSERT INTO public.comments VALUES (319, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 05:54:54.285', '2026-11-24 05:54:54.285', 1, 4);
INSERT INTO public.comments VALUES (320, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 05:55:54.285', '2026-11-24 05:55:54.285', 4, 4);
INSERT INTO public.comments VALUES (321, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 05:56:54.285', '2026-11-24 05:56:54.285', 5, 4);
INSERT INTO public.comments VALUES (322, 2, '다들 같은 생각이네요', 0, '2026-11-24 05:57:54.285', '2026-11-24 05:57:54.285', 2, 4);
INSERT INTO public.comments VALUES (323, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 05:58:54.285', '2026-11-24 05:58:54.285', 3, 4);
INSERT INTO public.comments VALUES (324, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 05:59:54.285', '2026-11-24 05:59:54.285', 1, 4);
INSERT INTO public.comments VALUES (325, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 06:00:54.285', '2026-11-24 06:00:54.285', 4, 4);
INSERT INTO public.comments VALUES (326, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 06:01:54.285', '2026-11-24 06:01:54.285', 5, 4);
INSERT INTO public.comments VALUES (327, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 06:02:54.285', '2026-11-24 06:02:54.285', 2, 4);
INSERT INTO public.comments VALUES (328, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 06:03:54.285', '2026-11-24 06:03:54.285', 3, 4);
INSERT INTO public.comments VALUES (329, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 06:04:54.285', '2026-11-24 06:04:54.285', 1, 4);
INSERT INTO public.comments VALUES (330, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 06:05:54.285', '2026-11-24 06:05:54.285', 4, 4);
INSERT INTO public.comments VALUES (331, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 06:06:54.285', '2026-11-24 06:06:54.285', 5, 4);
INSERT INTO public.comments VALUES (332, 2, '다들 같은 생각이네요', 0, '2026-11-24 06:07:54.285', '2026-11-24 06:07:54.285', 2, 4);
INSERT INTO public.comments VALUES (333, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 06:08:54.285', '2026-11-24 06:08:54.285', 3, 4);
INSERT INTO public.comments VALUES (334, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 06:09:54.285', '2026-11-24 06:09:54.285', 1, 4);
INSERT INTO public.comments VALUES (335, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 06:10:54.285', '2026-11-24 06:10:54.285', 4, 4);
INSERT INTO public.comments VALUES (336, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 06:11:54.285', '2026-11-24 06:11:54.285', 5, 4);
INSERT INTO public.comments VALUES (337, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 06:12:54.285', '2026-11-24 06:12:54.285', 2, 4);
INSERT INTO public.comments VALUES (338, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 06:13:54.285', '2026-11-24 06:13:54.285', 3, 4);
INSERT INTO public.comments VALUES (339, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 06:14:54.285', '2026-11-24 06:14:54.285', 1, 4);
INSERT INTO public.comments VALUES (340, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 06:15:54.285', '2026-11-24 06:15:54.285', 4, 4);
INSERT INTO public.comments VALUES (341, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 06:16:54.285', '2026-11-24 06:16:54.285', 5, 4);
INSERT INTO public.comments VALUES (342, 2, '다들 같은 생각이네요', 0, '2026-11-24 06:17:54.285', '2026-11-24 06:17:54.285', 2, 4);
INSERT INTO public.comments VALUES (343, 2, '고마워요, 오늘 아침에 구웠어요', 0, '2026-11-24 06:18:54.285', '2026-11-24 06:18:54.285', 3, 4);
INSERT INTO public.comments VALUES (344, 2, '버터 향이 여기까지 나는 것 같아요', 0, '2026-11-24 06:19:54.285', '2026-11-24 06:19:54.285', 1, 4);
INSERT INTO public.comments VALUES (345, 2, '저도 색 보고 놀랐어요', 0, '2026-11-24 06:20:54.285', '2026-11-24 06:20:54.285', 4, 4);
INSERT INTO public.comments VALUES (346, 2, '빵집에서 파는 것 같아요', 0, '2026-11-24 06:21:54.285', '2026-11-24 06:21:54.285', 5, 4);
INSERT INTO public.comments VALUES (347, 2, '그쵸, 색이 제일 먼저 보였어요', 0, '2026-11-24 06:22:54.285', '2026-11-24 06:22:54.285', 2, 4);
INSERT INTO public.comments VALUES (348, 2, '다음엔 더 진하게 구워 볼게요', 0, '2026-11-24 06:23:54.285', '2026-11-24 06:23:54.285', 3, 4);
INSERT INTO public.comments VALUES (349, 2, '오븐 몇 도였는지 궁금해요', 0, '2026-11-24 06:24:54.285', '2026-11-24 06:24:54.285', 1, 4);
INSERT INTO public.comments VALUES (350, 2, '한 입 먹어 보고 싶어요', 0, '2026-11-24 06:25:54.285', '2026-11-24 06:25:54.285', 4, 4);
INSERT INTO public.comments VALUES (351, 2, '사진도 잘 찍으셨네요', 0, '2026-11-24 06:26:54.285', '2026-11-24 06:26:54.285', 5, 4);
INSERT INTO public.comments VALUES (352, 2, '다들 같은 생각이네요', 0, '2026-11-24 06:27:54.285', '2026-11-24 06:27:54.285', 2, 4);
INSERT INTO public.comments VALUES (356, 1, '@dahye 저도 같이 가요', 0, '2026-11-24 06:41:48.96', '2026-11-24 06:41:48.96', 2, 1);
INSERT INTO public.comments VALUES (357, 2, '@jaehoon 저도 한 입만요', 0, '2026-11-24 06:42:19.264', '2026-11-24 06:42:19.264', 2, 4);
INSERT INTO public.comments VALUES (359, 1, '@dahye 셋이 가요', 0, '2026-11-24 06:44:08.388', '2026-11-24 06:44:08.388', 2, 1);
INSERT INTO public.comments VALUES (360, 2, '@jaehoon 버터 향이 좋아요', 0, '2026-11-24 06:44:17.653', '2026-11-24 06:44:17.653', 2, 4);


--
-- Data for Name: hashtags; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.hashtags VALUES (6, '한강', 1);
INSERT INTO public.hashtags VALUES (1, '바다', 1);
INSERT INTO public.hashtags VALUES (4, 'sunset', 0);
INSERT INTO public.hashtags VALUES (2, '노을', 27);


--
-- Data for Name: post_hashtags; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.post_hashtags VALUES (1, 28, 1);
INSERT INTO public.post_hashtags VALUES (2, 28, 2);
INSERT INTO public.post_hashtags VALUES (3, 29, 2);
INSERT INTO public.post_hashtags VALUES (5, 1, 2);
INSERT INTO public.post_hashtags VALUES (6, 1, 6);
INSERT INTO public.post_hashtags VALUES (9, 30, 2);
INSERT INTO public.post_hashtags VALUES (10, 31, 2);
INSERT INTO public.post_hashtags VALUES (11, 32, 2);
INSERT INTO public.post_hashtags VALUES (12, 33, 2);
INSERT INTO public.post_hashtags VALUES (13, 34, 2);
INSERT INTO public.post_hashtags VALUES (14, 35, 2);
INSERT INTO public.post_hashtags VALUES (15, 36, 2);
INSERT INTO public.post_hashtags VALUES (16, 37, 2);
INSERT INTO public.post_hashtags VALUES (17, 38, 2);
INSERT INTO public.post_hashtags VALUES (18, 39, 2);
INSERT INTO public.post_hashtags VALUES (19, 40, 2);
INSERT INTO public.post_hashtags VALUES (20, 41, 2);
INSERT INTO public.post_hashtags VALUES (21, 42, 2);
INSERT INTO public.post_hashtags VALUES (22, 43, 2);
INSERT INTO public.post_hashtags VALUES (23, 44, 2);
INSERT INTO public.post_hashtags VALUES (24, 45, 2);
INSERT INTO public.post_hashtags VALUES (25, 46, 2);
INSERT INTO public.post_hashtags VALUES (26, 47, 2);
INSERT INTO public.post_hashtags VALUES (27, 48, 2);
INSERT INTO public.post_hashtags VALUES (28, 49, 2);
INSERT INTO public.post_hashtags VALUES (29, 50, 2);
INSERT INTO public.post_hashtags VALUES (30, 51, 2);
INSERT INTO public.post_hashtags VALUES (31, 52, 2);
INSERT INTO public.post_hashtags VALUES (32, 53, 2);


--
-- Data for Name: post_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.post_images VALUES (1, 1, 'https://picsum.photos/seed/post1/600/600', 1);
INSERT INTO public.post_images VALUES (2, 1, 'https://picsum.photos/seed/post1b/600/600', 2);
INSERT INTO public.post_images VALUES (3, 1, 'https://picsum.photos/seed/post1c/600/600', 3);
INSERT INTO public.post_images VALUES (4, 2, 'https://picsum.photos/seed/post2/600/600', 1);
INSERT INTO public.post_images VALUES (5, 2, 'https://picsum.photos/seed/post2b/600/600', 2);
INSERT INTO public.post_images VALUES (6, 3, 'https://picsum.photos/seed/post3/600/600', 1);
INSERT INTO public.post_images VALUES (7, 4, 'https://picsum.photos/seed/post6/600/600', 1);
INSERT INTO public.post_images VALUES (8, 5, 'https://picsum.photos/seed/post7/600/600', 1);
INSERT INTO public.post_images VALUES (11, 9, 'https://picsum.photos/seed/post8/600/600', 1);
INSERT INTO public.post_images VALUES (12, 9, 'https://picsum.photos/seed/post9/600/600', 2);
INSERT INTO public.post_images VALUES (15, 14, '/uploads/4a858533-6237-49d9-ae3b-5b64be4b257d.jpg', 1);
INSERT INTO public.post_images VALUES (25, 26, '/uploads/606f29c9-1749-4b23-b017-e900dcf90c1f.jpg', 1);
INSERT INTO public.post_images VALUES (27, 28, '/uploads/f63dc882-7992-4824-b80e-435c479baa30.jpg', 1);
INSERT INTO public.post_images VALUES (28, 29, '/uploads/0f6d11bd-bc0d-4524-a4da-57ab8cd988ce.jpg', 1);
INSERT INTO public.post_images VALUES (29, 32, 'https://picsum.photos/seed/sunset32b/600/600', 2);
INSERT INTO public.post_images VALUES (30, 36, 'https://picsum.photos/seed/sunset36b/600/600', 2);
INSERT INTO public.post_images VALUES (31, 40, 'https://picsum.photos/seed/sunset40b/600/600', 2);
INSERT INTO public.post_images VALUES (32, 44, 'https://picsum.photos/seed/sunset44b/600/600', 2);
INSERT INTO public.post_images VALUES (33, 48, 'https://picsum.photos/seed/sunset48b/600/600', 2);
INSERT INTO public.post_images VALUES (34, 52, 'https://picsum.photos/seed/sunset52b/600/600', 2);
INSERT INTO public.post_images VALUES (35, 30, 'https://picsum.photos/seed/sunset30/600/600', 1);
INSERT INTO public.post_images VALUES (36, 31, 'https://picsum.photos/seed/sunset31/600/600', 1);
INSERT INTO public.post_images VALUES (37, 32, 'https://picsum.photos/seed/sunset32/600/600', 1);
INSERT INTO public.post_images VALUES (38, 33, 'https://picsum.photos/seed/sunset33/600/600', 1);
INSERT INTO public.post_images VALUES (39, 34, 'https://picsum.photos/seed/sunset34/600/600', 1);
INSERT INTO public.post_images VALUES (40, 35, 'https://picsum.photos/seed/sunset35/600/600', 1);
INSERT INTO public.post_images VALUES (41, 36, 'https://picsum.photos/seed/sunset36/600/600', 1);
INSERT INTO public.post_images VALUES (42, 37, 'https://picsum.photos/seed/sunset37/600/600', 1);
INSERT INTO public.post_images VALUES (43, 38, 'https://picsum.photos/seed/sunset38/600/600', 1);
INSERT INTO public.post_images VALUES (44, 39, 'https://picsum.photos/seed/sunset39/600/600', 1);
INSERT INTO public.post_images VALUES (45, 40, 'https://picsum.photos/seed/sunset40/600/600', 1);
INSERT INTO public.post_images VALUES (46, 41, 'https://picsum.photos/seed/sunset41/600/600', 1);
INSERT INTO public.post_images VALUES (47, 42, 'https://picsum.photos/seed/sunset42/600/600', 1);
INSERT INTO public.post_images VALUES (48, 43, 'https://picsum.photos/seed/sunset43/600/600', 1);
INSERT INTO public.post_images VALUES (49, 44, 'https://picsum.photos/seed/sunset44/600/600', 1);
INSERT INTO public.post_images VALUES (50, 45, 'https://picsum.photos/seed/sunset45/600/600', 1);
INSERT INTO public.post_images VALUES (51, 46, 'https://picsum.photos/seed/sunset46/600/600', 1);
INSERT INTO public.post_images VALUES (52, 47, 'https://picsum.photos/seed/sunset47/600/600', 1);
INSERT INTO public.post_images VALUES (53, 48, 'https://picsum.photos/seed/sunset48/600/600', 1);
INSERT INTO public.post_images VALUES (54, 49, 'https://picsum.photos/seed/sunset49/600/600', 1);
INSERT INTO public.post_images VALUES (55, 50, 'https://picsum.photos/seed/sunset50/600/600', 1);
INSERT INTO public.post_images VALUES (56, 51, 'https://picsum.photos/seed/sunset51/600/600', 1);
INSERT INTO public.post_images VALUES (57, 52, 'https://picsum.photos/seed/sunset52/600/600', 1);
INSERT INTO public.post_images VALUES (58, 53, 'https://picsum.photos/seed/sunset53/600/600', 1);
INSERT INTO public.post_images VALUES (59, 54, '/uploads/4af900b8-1cd8-47a4-8df0-b48ee362755d.jpg', 1);


--
-- Data for Name: post_likes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.post_likes VALUES (3, 9, 2);
INSERT INTO public.post_likes VALUES (5, 2, 2);
INSERT INTO public.post_likes VALUES (6, 14, 2);
INSERT INTO public.post_likes VALUES (11, 1, 2);


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.posts VALUES (3, '농구 코트', '주말마다 여기 옵니다', 76, 2, '2026-11-23 23:51:27.055', '2026-11-23 23:51:27.055', 5);
INSERT INTO public.posts VALUES (4, '새 렌즈', '새로 산 렌즈로 찍어봤어요', 205, 0, '2026-11-23 21:51:27.058', '2026-11-23 21:51:27.058', 3);
INSERT INTO public.posts VALUES (5, '저녁 산책', '동네 한 바퀴', 34, 0, '2026-11-23 19:51:27.06', '2026-11-23 19:51:27.06', 1);
INSERT INTO public.posts VALUES (9, '제주도 바다 사진', '제주 왔어요 🌊', 1, 0, '2026-11-24 02:51:27.994', '2026-11-24 02:51:27.994', 3);
INSERT INTO public.posts VALUES (14, '바다에 다녀왔어요', '주말에 바다에 다녀왔어요', 1, 0, '2026-11-24 02:52:14.097', '2026-11-24 02:52:33.674', 2);
INSERT INTO public.posts VALUES (2, '갓 구운 크루아상', '오늘 아침에 구운 크루아상', 513, 39, '2026-11-24 02:06:27.051', '2026-11-24 06:13:39.042', 3);
INSERT INTO public.posts VALUES (26, '', '#노을빛 하늘이 오래 남았어요 #한강', 0, 0, '2026-11-24 08:17:26.372', '2026-11-24 08:17:26.372', 2);
INSERT INTO public.posts VALUES (28, '', '노을 보러 또 왔어요 #바다 #노을', 0, 0, '2026-11-24 08:19:20.891', '2026-11-24 08:19:20.891', 2);
INSERT INTO public.posts VALUES (29, '', '#노을 질 때 다시 왔어요', 0, 0, '2026-11-24 08:19:21.014', '2026-11-24 08:20:23.215', 2);
INSERT INTO public.posts VALUES (30, NULL, '노을 사진 1번째 #노을', 0, 0, '2026-01-01 08:00:00', '2026-01-01 08:00:00', 3);
INSERT INTO public.posts VALUES (31, NULL, '노을 사진 2번째 #노을', 0, 0, '2026-01-01 07:00:00', '2026-01-01 07:00:00', 3);
INSERT INTO public.posts VALUES (32, NULL, '노을 사진 3번째 #노을', 0, 0, '2026-01-01 06:00:00', '2026-01-01 06:00:00', 3);
INSERT INTO public.posts VALUES (33, NULL, '노을 사진 4번째 #노을', 0, 0, '2026-01-01 05:00:00', '2026-01-01 05:00:00', 3);
INSERT INTO public.posts VALUES (34, NULL, '노을 사진 5번째 #노을', 0, 0, '2026-01-01 04:00:00', '2026-01-01 04:00:00', 3);
INSERT INTO public.posts VALUES (35, NULL, '노을 사진 6번째 #노을', 0, 0, '2026-01-01 03:00:00', '2026-01-01 03:00:00', 3);
INSERT INTO public.posts VALUES (36, NULL, '노을 사진 7번째 #노을', 0, 0, '2026-01-01 02:00:00', '2026-01-01 02:00:00', 3);
INSERT INTO public.posts VALUES (37, NULL, '노을 사진 8번째 #노을', 0, 0, '2026-01-01 01:00:00', '2026-01-01 01:00:00', 3);
INSERT INTO public.posts VALUES (38, NULL, '노을 사진 9번째 #노을', 0, 0, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 3);
INSERT INTO public.posts VALUES (39, NULL, '노을 사진 10번째 #노을', 0, 0, '2025-12-31 23:00:00', '2025-12-31 23:00:00', 3);
INSERT INTO public.posts VALUES (40, NULL, '노을 사진 11번째 #노을', 0, 0, '2025-12-31 22:00:00', '2025-12-31 22:00:00', 3);
INSERT INTO public.posts VALUES (41, NULL, '노을 사진 12번째 #노을', 0, 0, '2025-12-31 21:00:00', '2025-12-31 21:00:00', 3);
INSERT INTO public.posts VALUES (42, NULL, '노을 사진 13번째 #노을', 0, 0, '2025-12-31 20:00:00', '2025-12-31 20:00:00', 3);
INSERT INTO public.posts VALUES (43, NULL, '노을 사진 14번째 #노을', 0, 0, '2025-12-31 19:00:00', '2025-12-31 19:00:00', 3);
INSERT INTO public.posts VALUES (44, NULL, '노을 사진 15번째 #노을', 0, 0, '2025-12-31 18:00:00', '2025-12-31 18:00:00', 3);
INSERT INTO public.posts VALUES (45, NULL, '노을 사진 16번째 #노을', 0, 0, '2025-12-31 17:00:00', '2025-12-31 17:00:00', 3);
INSERT INTO public.posts VALUES (46, NULL, '노을 사진 17번째 #노을', 0, 0, '2025-12-31 16:00:00', '2025-12-31 16:00:00', 3);
INSERT INTO public.posts VALUES (47, NULL, '노을 사진 18번째 #노을', 0, 0, '2025-12-31 15:00:00', '2025-12-31 15:00:00', 3);
INSERT INTO public.posts VALUES (48, NULL, '노을 사진 19번째 #노을', 0, 0, '2025-12-31 14:00:00', '2025-12-31 14:00:00', 3);
INSERT INTO public.posts VALUES (49, NULL, '노을 사진 20번째 #노을', 0, 0, '2025-12-31 13:00:00', '2025-12-31 13:00:00', 3);
INSERT INTO public.posts VALUES (50, NULL, '노을 사진 21번째 #노을', 0, 0, '2025-12-31 12:00:00', '2025-12-31 12:00:00', 3);
INSERT INTO public.posts VALUES (51, NULL, '노을 사진 22번째 #노을', 0, 0, '2025-12-31 11:00:00', '2025-12-31 11:00:00', 3);
INSERT INTO public.posts VALUES (52, NULL, '노을 사진 23번째 #노을', 0, 0, '2025-12-31 10:00:00', '2025-12-31 10:00:00', 3);
INSERT INTO public.posts VALUES (53, NULL, '노을 사진 24번째 #노을', 0, 0, '2025-12-31 09:00:00', '2025-12-31 09:00:00', 3);
INSERT INTO public.posts VALUES (1, '노을 진 한강', '퇴근길에 한강이 너무 예뻤어요 #노을 #한강', 131, 4, '2026-11-24 02:39:27.04', '2026-11-24 08:20:23.409', 2);
INSERT INTO public.posts VALUES (54, '처음 올린 글이에요', '처음 올린 글이에요', 0, 0, '2026-11-25 02:31:48.191', '2026-11-25 02:31:48.191', 43);


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.sessions VALUES ('dff6d361-56d3-4c42-8d7b-7c982ce6f4e2', 2, '2026-12-01 02:51:57.933', '2026-11-24 02:51:57.933', NULL, NULL);
INSERT INTO public.sessions VALUES ('93ac8188-57dd-46aa-868e-729616262e56', 2, '2026-12-01 02:52:01.127', '2026-11-24 02:52:01.127', NULL, NULL);
INSERT INTO public.sessions VALUES ('06e5eaea-224c-4e51-beb9-a12a60574990', 2, '2026-12-01 02:52:01.127', '2026-11-24 02:52:01.127', NULL, NULL);
INSERT INTO public.sessions VALUES ('9ae66248-b7c4-44a5-af6a-3e69627d95b9', 2, '2026-12-01 02:52:01.127', '2026-11-24 02:52:01.127', NULL, NULL);
INSERT INTO public.sessions VALUES ('a0c36c3d-c7ed-4ae9-a351-3106503aff07', 45, '2026-12-01 02:52:01.127', '2026-11-24 02:52:01.127', NULL, NULL);
INSERT INTO public.sessions VALUES ('a6bb310a-2508-4f03-afa1-7f08e00ab246', 45, '2026-12-01 02:52:01.127', '2026-11-24 02:52:01.127', NULL, NULL);
INSERT INTO public.sessions VALUES ('3695932f-1d12-428a-b71e-bce5f571ab34', 2, '2026-12-01 02:52:03.417', '2026-11-24 02:52:03.417', 'b5b89ccaa1f28b19807fa2fb9b2a43ed355f6ab1be7e3f325f9d2d9f19bc0256', NULL);
INSERT INTO public.sessions VALUES ('cbda2802-c108-40c5-a2c6-0ba7030a0b91', 2, '2026-12-01 02:52:03.417', '2026-11-24 02:52:03.417', '3856305ae0a86d9e984ab6ea0ed2a1247f4f8aa854df38bd298591879d621ad1', NULL);
INSERT INTO public.sessions VALUES ('e1a1ac41-866a-481f-9bb0-9af960054c4d', 2, '2026-12-01 02:52:03.417', '2026-11-24 02:52:03.417', '4463e328a50499948103b6d0e7318bcd374169ad2c234e75fb22b8216243949b', NULL);
INSERT INTO public.sessions VALUES ('06c12709-3375-4e8c-bc47-a6db42c460ed', 2, '2026-12-01 02:52:03.417', '2026-11-24 02:52:03.417', 'cb992923d043d7615430c188f0eb9193f9c6c49761a3c0272a8b3c1f694b295f', '3dfb21c49be7fcd9c1cdce3ca40fcfa6edfe9d1476e6a46d1f2769be649beeed');
INSERT INTO public.sessions VALUES ('02cda754-b353-49aa-a106-4ec7bb84b1ef', 52, '2026-12-01 02:52:06.61', '2026-11-24 02:52:06.61', '770afa737c575137c43379ea8b84de2ba4e07adeb14d4aac3b2e51e0ffd19eea', NULL);
INSERT INTO public.sessions VALUES ('ab13cd2a-3f15-4e74-babd-d8be2923bfb1', 52, '2026-12-01 02:52:06.61', '2026-11-24 02:52:06.61', 'c731779add65625a400fbd338b756681d8ce0288877b737a77761d1191335d9d', NULL);
INSERT INTO public.sessions VALUES ('fb0b7d95-2b15-40dc-8682-a6b2f69eee8c', 54, '2026-12-01 02:52:07.801', '2026-11-24 02:52:07.801', '4dcd92f002a3bd1613bcbcd2beb875eec5d21a66add903925d7f2503f5939e99', NULL);
INSERT INTO public.sessions VALUES ('e959781e-f450-4a4e-a7e0-ef63527dab25', 2, '2026-12-01 02:52:13.952', '2026-11-24 02:52:13.956', 'c48e60c0e2da1896b1ebe01d1b6fd43baf002688f3a9c791375d256e6d27fc2d', NULL);
INSERT INTO public.sessions VALUES ('e3ad58b7-fcf8-44a5-aa2f-4f847d268f44', 2, '2026-12-01 02:52:16.797', '2026-11-24 02:52:16.8', '806919abca4b85032ba8701ffc8a16b870b9da446009f6db6cbbaf5c1c5eafe5', NULL);
INSERT INTO public.sessions VALUES ('a4908acc-c9f7-4afd-afda-d96cfe66e773', 2, '2026-12-01 02:52:17.132', '2026-11-24 02:52:17.132', '4e857a51c1f2d7ed0cfe7401467d167a054427f08003a87e90321b3380c67443', NULL);
INSERT INTO public.sessions VALUES ('e8f81c8c-ca9d-42a8-821f-f25d4f75635c', 43, '2026-12-01 02:52:17.739', '2026-11-24 02:52:17.739', '038d5ab335cf464601ea4e2694b0bbd1cf4d26981440e9f62d68b020d9ef0fe0', NULL);
INSERT INTO public.sessions VALUES ('d6508a1d-691f-4f55-8138-418babea09a0', 2, '2026-12-01 02:52:20.309', '2026-11-24 02:52:20.313', '698d3b2cd6bcb9f9273a1492904e7ba3555188b025a696bcd6045ae8380060dd', NULL);
INSERT INTO public.sessions VALUES ('c6121e9a-b939-4379-bdac-e78a6f698af1', 2, '2026-12-01 02:52:21.672', '2026-11-24 02:52:21.676', '9a9f5f3b315515b8a04ac8775697c360103810722e570386bcc5d4d3e4d2b507', NULL);
INSERT INTO public.sessions VALUES ('ff3b6d55-795d-4ffe-8942-89d47cf1f093', 43, '2026-12-01 02:52:22.296', '2026-11-24 02:52:22.296', '6c0b4fa3e05739c03cfc521f1f3da91564758a786b4f8155508f2b651d285a4d', NULL);
INSERT INTO public.sessions VALUES ('5047bb35-80d9-48dd-80b1-06016e0322d9', 2, '2026-12-01 02:52:22.69', '2026-11-24 02:52:22.69', '75d5e2d8051697798e1787f2ac452979a68b6adbdb4808a58dc7f6b4d0142ef2', NULL);
INSERT INTO public.sessions VALUES ('b9428ffa-29e1-4e43-849b-03cdcac9d259', 2, '2026-12-01 02:52:32.818', '2026-11-24 02:52:32.821', 'fc52eedfdcb962caa25c3d5c9c5993884c51fb62021e39db77f6ea06ce6a214c', NULL);
INSERT INTO public.sessions VALUES ('739edaf9-dd71-4394-9998-e25d84fa3c84', 2, '2026-12-01 02:52:33.378', '2026-11-24 02:52:33.378', '9740e426d252176f2a912e1bfbaf4d2ea8b2e85488b057becbc88b497db1c6c4', NULL);
INSERT INTO public.sessions VALUES ('b68ae0eb-c06d-488b-bede-e25f4f561e9c', 2, '2026-12-01 02:52:39.312', '2026-11-24 02:52:39.315', '1b1906ab3dc8552ea8354db3de826a0ae84f2c953c4aacd2d51e632c372ec055', NULL);
INSERT INTO public.sessions VALUES ('ced86809-916b-442f-bed7-c62e08d4b1b8', 2, '2026-12-01 06:13:36.283', '2026-11-24 06:13:36.287', '8abf959afb9e15cb7f4c25e6141f4006dad14c239b0233c6ee2cc7a057c87d61', NULL);
INSERT INTO public.sessions VALUES ('b3d299a3-e82e-4251-99d1-5555b49ede2e', 2, '2026-12-01 06:13:40.469', '2026-11-24 06:13:40.47', '8ccdf3f7def63c8343e5667aaad7c747127937da41858887384456d7c61d2e7d', NULL);
INSERT INTO public.sessions VALUES ('fa04260b-7369-46f3-9b4e-6c533ace2585', 2, '2026-12-01 06:13:43.292', '2026-11-24 06:13:43.293', 'd86e3adcfede3618798c6dd98577e7572e9ed8985df2ea489f48aa040fa81f21', NULL);
INSERT INTO public.sessions VALUES ('31788e91-7e8a-4ce0-b5f8-d888155e813e', 2, '2026-12-01 06:13:46.466', '2026-11-24 06:13:46.467', '492e0b05e6e1f54e865597047007ecdc29b80b7e783c0497ec3549cfd4f498e8', NULL);
INSERT INTO public.sessions VALUES ('c7189e73-a902-4878-9128-36f2a884c27d', 2, '2026-12-01 06:25:52.846', '2026-11-24 06:25:52.85', '9c3587f826bdf585b10e024e46aadf0af80324cc684e1ebe4dfe384f15599e54', NULL);
INSERT INTO public.sessions VALUES ('701c9120-75bc-4eb2-8730-cec718d9cbd4', 2, '2026-12-01 06:31:47.667', '2026-11-24 06:31:47.671', 'e2fb1b4423560dcf2c063b1d0358c9a758b66870f026f7baf9b2fdd00bcdfe44', NULL);
INSERT INTO public.sessions VALUES ('0e2f11c3-dabe-4bcd-a269-d5422f4312c7', 2, '2026-12-01 06:33:51.947', '2026-11-24 06:33:51.947', '359fef6d1c2841686d66c8a6ef311eba635d8e097b14c7a2b1150c4c48e283b3', NULL);
INSERT INTO public.sessions VALUES ('289fa005-7e73-4ba1-8bda-e4a592098a3b', 2, '2026-12-01 06:34:16.952', '2026-11-24 06:34:16.952', '39999978b7402820aa0b7c8e4321cd00491540c354fda1039c7bf6048802d95d', NULL);
INSERT INTO public.sessions VALUES ('19c1cc45-6312-4cba-88c8-c2b20f125afd', 2, '2026-12-01 06:34:50.64', '2026-11-24 06:34:50.64', '398ff7dfb5e5b0062bc7c104f8fc1b7cc1d0ccd8959ff8d1af56fc14b268d049', NULL);
INSERT INTO public.sessions VALUES ('7f6d73b1-9ba7-4e80-81d5-2722b6e93019', 2, '2026-12-01 06:35:19.339', '2026-11-24 06:35:19.34', '6ff0e22fc11bd5eb266dcd18e26d9572039c19f9c0ed8283e041c7c3e00d4cf6', NULL);
INSERT INTO public.sessions VALUES ('7db77a06-e904-4185-933b-8147b090adb6', 2, '2026-12-01 06:36:09.447', '2026-11-24 06:36:09.447', 'c821c2ce00c62f2c5147119231e23136e42f2d9efc13b8018789935530c4c830', NULL);
INSERT INTO public.sessions VALUES ('208159ae-cf84-49c8-b5b8-2741c0d2ac7a', 2, '2026-12-01 06:37:09.579', '2026-11-24 06:37:09.579', '992cb8a8f80c59fd02dc1beb9b25b658e22a8b8d94cedc4df000425b90605fc9', NULL);
INSERT INTO public.sessions VALUES ('d77903ca-1a4d-460a-866e-7c8a0e5dbbcc', 2, '2026-12-01 06:41:34.213', '2026-11-24 06:41:34.213', '731edad300bc863ea151a01b7f0295f41497ab65daea4e6e64af17d09959b249', NULL);
INSERT INTO public.sessions VALUES ('95f11e60-8f50-4d2b-8146-49b636ee35ca', 2, '2026-12-01 06:42:08.787', '2026-11-24 06:42:08.788', '3d239aa6adb88b4113c522d79261477e244ac7ee42020e060aa44cf568160fe1', NULL);
INSERT INTO public.sessions VALUES ('2dd854e6-ac32-41c0-814e-ec243955eee5', 2, '2026-12-01 06:42:57.589', '2026-11-24 06:42:57.589', 'b297fbcc29c7165e63e8acb52b71589553b0aeeea484f9525dbf413820c4fef0', NULL);
INSERT INTO public.sessions VALUES ('fe42d8a9-21a5-4d40-9f90-da59f9b2f292', 2, '2026-12-01 06:43:52.013', '2026-11-24 06:43:52.013', '308fe367000f6fe6d8c62e33c74eaba63b7f6a1f6d2dcbbee08c75d4bf965a1e', NULL);
INSERT INTO public.sessions VALUES ('dc3b97fd-b58e-4cb5-b041-4456fbeb609a', 2, '2026-12-01 06:45:14.943', '2026-11-24 06:45:14.943', 'f864941ceed2070f385bba5daebdb240ffbaf16d55106034ffdd0e9cd88f4587', NULL);
INSERT INTO public.sessions VALUES ('9079128d-8b7d-4df5-9187-a3d6815e442e', 2, '2026-12-01 06:45:40.767', '2026-11-24 06:45:40.767', '86f314b27b34c659e4b6f661a541286fa787786745d083fef7c3062ea1e3a5d2', NULL);
INSERT INTO public.sessions VALUES ('71d34cde-89c7-4a10-992f-fe6fcd71ffc6', 2, '2026-12-01 06:46:27.261', '2026-11-24 06:46:27.261', '6562e159945b9f26b2bc7c626c1d2855c01f5d72d64c859d8da07b87325264f6', NULL);
INSERT INTO public.sessions VALUES ('0d792ed7-f912-46ad-804e-4b04e4750353', 2, '2026-12-01 08:17:21.773', '2026-11-24 08:17:21.776', 'bc01b952b7045e58c76820de27f896b28ad05e738dd2e8a59c8484bf5ee73e19', NULL);
INSERT INTO public.sessions VALUES ('ae581c36-159d-4cf9-80ad-d71cde839a5c', 2, '2026-12-01 08:20:45.987', '2026-11-24 08:20:45.988', '135ba6c5ce7c257d16fe27392790fe211ae5e1e14dc04cd8a3dddd688545f80f', NULL);
INSERT INTO public.sessions VALUES ('11ead14b-bb53-4ed4-9cad-c3d448e6b998', 2, '2026-12-01 08:21:03.833', '2026-11-24 08:21:03.833', 'ade3838843afcc0ddd39b8fd6598830c1d9bf9627e6dbd171d0f80a76e0be21b', NULL);
INSERT INTO public.sessions VALUES ('f788cdb5-44a9-484d-bb50-df19f5dedfc1', 2, '2026-12-01 08:21:05.807', '2026-11-24 08:21:05.807', '0c6b7f487aaec80ce9bbc42f4d1d55465dd88654bee79ba6d6356446770eb771', NULL);
INSERT INTO public.sessions VALUES ('15fe811d-f512-4e37-8e60-c3f083cdbede', 2, '2026-12-01 08:21:07.786', '2026-11-24 08:21:07.786', '43bfd918180aa4c7839645079f0477e7c227f5834e096a1e83e05d97199e60b9', NULL);
INSERT INTO public.sessions VALUES ('e130f21c-3c98-46a4-9b49-a972ea5e9d61', 2, '2026-12-01 08:21:09.702', '2026-11-24 08:21:09.703', '7d346b58157c113501ad1fdfc816f540b8e2c34ea6ff8769f6d4da68b444dff2', NULL);
INSERT INTO public.sessions VALUES ('c7067586-7fed-4aa5-9e59-b436c7665e26', 2, '2026-12-01 08:21:11.631', '2026-11-24 08:21:11.632', '80c77e85354b13f73dc966f0daef74aa947e1d2c5ec15f80cdebc8c6dce50c92', NULL);
INSERT INTO public.sessions VALUES ('33a5da9e-22e3-4b69-9c70-792400ce9f8e', 2, '2026-12-01 08:21:48.715', '2026-11-24 08:21:48.716', '2a520bcdfd924816a904f38d88f04f796e8dfda4dd565d9d84cea2acae98a066', NULL);
INSERT INTO public.sessions VALUES ('c84cfd48-5029-4b9c-b9ad-00922b89a322', 2, '2026-12-01 08:22:06.82', '2026-11-24 08:22:06.82', '2a6fefae115ac611bd0dedd67b5bd9648eb4d73b135c1783b3a62b93fc940a87', NULL);
INSERT INTO public.sessions VALUES ('74d632c9-19c2-4760-b78c-725009691d7e', 2, '2026-12-01 08:22:08.728', '2026-11-24 08:22:08.728', '240894eb10ee9366f61f0638cca8c18dab050b3e2682166405e4a503805f943d', NULL);
INSERT INTO public.sessions VALUES ('98b6b0e2-bf28-4f0a-a223-372f6dcf56bf', 2, '2026-12-01 08:22:10.645', '2026-11-24 08:22:10.646', 'e7540a93619c9cc5796d40ef07f505af9cfcdd39ca784692afa10f1c58b127da', NULL);
INSERT INTO public.sessions VALUES ('ba11dd03-40f7-401e-b893-547ab86962a1', 2, '2026-12-01 09:43:47.654', '2026-11-24 09:43:47.659', '5fab1b149de53c5ca9c8927268549f8fe63c3eb916bdde29c6510c9887bb9d80', NULL);
INSERT INTO public.sessions VALUES ('f7167c5b-e25f-46a8-95dd-7f13bdfa979e', 2, '2026-12-01 09:47:45.084', '2026-11-24 09:47:45.089', 'edd9722567db3c447956c10bae1a8fa7be753d18e19de6a9d775a4de040de2d8', NULL);
INSERT INTO public.sessions VALUES ('c068e75a-6ea7-4d12-9ffd-8acce2dd72b4', 2, '2026-12-01 09:48:09.345', '2026-11-24 09:48:09.345', '291b198024ada59f498c1d472b90955d859b8f65106044fe62f233ceb5fbd317', NULL);
INSERT INTO public.sessions VALUES ('f010cb41-f541-4ea4-9105-e683dd20c6fa', 2, '2026-12-01 09:48:31.573', '2026-11-24 09:48:31.574', '0c54452710445105ee42fb491cf44ba8d39674bbb7772ccf3ff4b61682d8215e', NULL);
INSERT INTO public.sessions VALUES ('2bd6ef48-d0fa-4bb3-af8f-61ae6d0f9bec', 2, '2026-12-01 09:48:52.819', '2026-11-24 09:48:52.82', 'b737b120f466f2591196db04cc294f6d0b7367e3dfb40bb1cc04ae5d25c7fee2', NULL);
INSERT INTO public.sessions VALUES ('16c26ed9-7b09-46d4-8aca-fd854010d7d8', 2, '2026-12-01 09:49:26.512', '2026-11-24 09:49:26.512', '2983a0465183c79e468ffddf89eda682687fca79d367bb66d8477e0e3d0fe3b9', NULL);
INSERT INTO public.sessions VALUES ('cc0ece1d-91a7-40b5-aed2-d5120bbb7b27', 2, '2026-12-01 09:50:24.593', '2026-11-24 09:50:24.593', '7cebeabc48b9a00ec6e73b7365916da43b2a6161458f71326dbe69b638653590', NULL);
INSERT INTO public.sessions VALUES ('330dd277-bc1c-4928-9134-a0f267c602c2', 2, '2026-12-01 09:50:52.412', '2026-11-24 09:50:52.412', '11696dbd4fe3b23ec6db07fb8ac1981174eb36283e18f6ed3c1791f16af90312', NULL);
INSERT INTO public.sessions VALUES ('a37df841-4871-4931-addc-d3f6ddd1f739', 2, '2026-12-01 09:51:08.169', '2026-11-24 09:51:08.169', 'a6a7592b41a92c84819dfb64374cb8bf8a417d770162e184edfde40cb76287e5', NULL);
INSERT INTO public.sessions VALUES ('01927717-b6c6-4b54-9382-e741f81883b4', 2, '2026-12-01 09:52:22.372', '2026-11-24 09:52:22.372', '4ec9b103ac3393f09eeb623303b0a278351f51adb4c844c3c4c2ec0a7f7542e4', NULL);
INSERT INTO public.sessions VALUES ('526ac0b7-9633-43b3-bf65-54e12f166f73', 2, '2026-12-01 09:52:47.33', '2026-11-24 09:52:47.33', '38299de86ead2e69ec105be2b625aa8b876109bc4e7a929b0b66ed6c9112f3df', NULL);
INSERT INTO public.sessions VALUES ('75110940-40de-44b3-afcc-1fbba7cfc201', 2, '2026-12-01 09:53:27.551', '2026-11-24 09:53:27.551', '27c1854ea23d4152ac19f1ae612d0ec22411c716ecb56595a0ab616f5a6a0426', NULL);
INSERT INTO public.sessions VALUES ('fe4f0318-6c11-44c5-a041-dbefb1a407b2', 2, '2026-12-01 09:54:09.234', '2026-11-24 09:54:09.234', '826c0eadf218ea61fa8121fdd23e3bed301bebaccf978c7cb561f0668f151d8c', NULL);
INSERT INTO public.sessions VALUES ('0ddd9410-ab30-43fe-b6a7-95ee7316a07b', 2, '2026-12-01 09:54:42.522', '2026-11-24 09:54:42.522', '93151f5302fdc7fd0ec19328f27ca5b95a9556de9ce67e07bd7f84f920885338', NULL);
INSERT INTO public.sessions VALUES ('2e8b3b5d-1c92-40c4-8a76-2c1c9b28a868', 2, '2026-12-01 09:55:16.78', '2026-11-24 09:55:16.78', '1552cee3812b44bcae4363f525932cc4de48b08b0d63dde3cb1e4ef3e2ea435c', NULL);
INSERT INTO public.sessions VALUES ('f1301e4e-fe23-4ad8-8d25-612307d75d95', 2, '2026-12-01 09:58:33.551', '2026-11-24 09:58:33.551', 'b78846953551e08a8f82b72a6bc4765729d166b27a410366f87609b117080b22', NULL);
INSERT INTO public.sessions VALUES ('ca25569e-750e-4bf0-9342-adb78cc55dd8', 2, '2026-12-01 09:59:06.472', '2026-11-24 09:59:06.472', '31bac90bd9949f16ecf9df0554cb4331785cf0bac02d814c59164f6f864228da', NULL);
INSERT INTO public.sessions VALUES ('8106764a-46e8-49d1-8b05-3131ee1f54c9', 2, '2026-12-01 09:59:39.706', '2026-11-24 09:59:39.707', '17af42b4a4b6b24c654aa805519ec852e73358566e99d698a9465544d9140f9a', NULL);
INSERT INTO public.sessions VALUES ('0b2bfb9d-a992-41ce-aea0-0a1cf859f0a6', 2, '2026-12-01 10:00:12.962', '2026-11-24 10:00:12.962', 'c0c6de6684dabfb6bb1b09324ccf23cebb8c177c0391f4cce60dc6b633da0e8d', NULL);
INSERT INTO public.sessions VALUES ('25f536d6-39cd-495a-bb4b-fa99c5a188e5', 2, '2026-12-01 10:00:39.937', '2026-11-24 10:00:39.937', '4265bac85faaa5c72f4ff3eac11964af2be084ce0f6ae392d0d0cac016762c74', NULL);
INSERT INTO public.sessions VALUES ('726b8b92-93ff-41e7-8879-039096d66808', 2, '2026-12-01 10:01:13.034', '2026-11-24 10:01:13.034', '514c4efa55bdcec0343e45b6250fec21f77322ac7c71ee53c2575baccf733418', NULL);
INSERT INTO public.sessions VALUES ('5fe3e4f1-cbd6-4ade-a80e-f7416bcb69e0', 2, '2026-12-01 10:01:43.432', '2026-11-24 10:01:43.433', '348fb7561b366f1257cac46f481e0bcbbb4f60608ecdfa256f81898d9adc4ad8', NULL);
INSERT INTO public.sessions VALUES ('364f4033-0599-4d29-bfbd-76efe55a2115', 2, '2026-12-01 10:02:14.963', '2026-11-24 10:02:14.963', 'f34ca94fece0b9e81a798a82f3aa2c4f44e401c9487325d8fff9e4a27cb8d280', NULL);
INSERT INTO public.sessions VALUES ('f98c3044-d59a-4fd6-a0c9-94d10b0dcadf', 2, '2026-12-01 10:06:40.013', '2026-11-24 10:06:40.013', 'b2194f6da682dad93a87c409416c848193b229c269df9d165ff8259f7e5cfeb6', NULL);
INSERT INTO public.sessions VALUES ('3b2a1d5b-e352-4ed0-bcfa-685ca5a25089', 2, '2026-12-01 10:07:13.538', '2026-11-24 10:07:13.538', '14bb58c521bc9731073f972bf5bb950491c6a4162e095797ac9b5bab246a16a2', NULL);
INSERT INTO public.sessions VALUES ('d97624a4-2ccb-48a6-8b02-714cea0d52e9', 2, '2026-12-01 10:07:48.282', '2026-11-24 10:07:48.282', '7e1031c6c8fbdb57814ce4f8fa9a5959ee87a02eb4c52bdb32ab8e4533ea910c', NULL);
INSERT INTO public.sessions VALUES ('e3d7f2ff-1b65-416e-81bd-b01a956c0f93', 2, '2026-12-02 02:15:41.246', '2026-11-25 02:15:41.25', 'b43b74f0b1254741e79cc7bc0178f523a884b2889f99835270dec1f8516db033', NULL);
INSERT INTO public.sessions VALUES ('10252893-1873-4f5c-8b94-3a424d2b3178', 2, '2026-12-02 02:16:11.461', '2026-11-25 02:16:11.461', 'db75cd3232af743ae6e6659060d1a44f5ba0a82e5a181cece4e44806ee849a5f', NULL);
INSERT INTO public.sessions VALUES ('f5a8dd20-beef-479c-98d4-88a426ff2103', 2, '2026-12-02 02:16:39.431', '2026-11-25 02:16:39.431', '0e984294b9e98b78909f73d78a0e10a2cec52687dc628b201133d921847205ce', NULL);
INSERT INTO public.sessions VALUES ('b211a439-b844-4846-a397-ce81504fa5d6', 2, '2026-12-02 02:17:46.85', '2026-11-25 02:17:46.854', '53f21d75ab023dd5a14592190054d0e0fc15200d0b31336ede3f01912a4e6f72', NULL);
INSERT INTO public.sessions VALUES ('6b415537-f462-4c02-bccd-2fa4be1637a0', 2, '2026-12-02 02:18:52.05', '2026-11-25 02:18:52.053', 'cf0cdd48576fa4d7d6d9e26ba348c620721087a19cd8e2fda67ee9bf2a7abbf8', NULL);
INSERT INTO public.sessions VALUES ('8940ed34-1cca-4bb2-8a1d-e222bfd6cc36', 2, '2026-12-02 02:19:53.255', '2026-11-25 02:19:53.255', '035ae93844c19ff89955c7218a0fdbabef698330e38a8b3cfb71386731bb5de8', NULL);
INSERT INTO public.sessions VALUES ('bb2a4dda-8e19-4a68-b6c6-ddee9aeb5b33', 2, '2026-12-02 02:20:22.486', '2026-11-25 02:20:22.486', 'cb89649f5287120f76e9a111af4eef172fba4421faa33af7128cf4f74f6dd928', NULL);
INSERT INTO public.sessions VALUES ('07d3717f-a876-496b-ab9b-e931a073be62', 2, '2026-12-02 02:24:33.323', '2026-11-25 02:24:33.327', '29ce9a4f9f09fdbb3cb3846ae1691be90693a0fe409a089cddc5223643ee2fdf', NULL);
INSERT INTO public.sessions VALUES ('e18a4e47-a792-4a54-8594-3a526d495dd4', 2, '2026-12-02 02:26:12.991', '2026-11-25 02:26:12.994', '43c5081054992c68c1b5c06baab310ec383e4b7ba39185c7d1b48cb194955b0c', NULL);
INSERT INTO public.sessions VALUES ('1614e1db-610e-4e6c-93db-a1106e633882', 2, '2026-12-02 02:26:55.417', '2026-11-25 02:26:55.421', '07fda553034944e6c4e7e6e7edc1cfa7b026dbc77d3260cb121e7f2f3a65a358', NULL);
INSERT INTO public.sessions VALUES ('09b9dc64-c95e-4e8d-88a9-b3bd0e1ad53e', 2, '2026-12-02 02:27:28.538', '2026-11-25 02:27:28.538', '4608dd2c196970ea12ef4dd50d130c7ec6d7f8823c4d1665ad0a75a125f3c889', NULL);
INSERT INTO public.sessions VALUES ('73befc63-d491-4514-8617-edf16a80ed64', 2, '2026-12-02 02:28:00.943', '2026-11-25 02:28:00.943', '3ae0e5a965bd4f24f0e7b63679c06b1eb42fbcbd0f8838b777d861fdf7dfd9f5', NULL);
INSERT INTO public.sessions VALUES ('3371ff83-4a96-4949-b08f-ee2b446d2873', 43, '2026-12-02 02:31:41.083', '2026-11-25 02:31:41.083', 'd07779908527eef04f250ddb1c4b7762682341918c0a3349448a50e10259e452', NULL);
INSERT INTO public.sessions VALUES ('bbcf8904-da60-4d30-bdff-21b38d461d6c', 43, '2026-12-02 02:32:35.835', '2026-11-25 02:32:35.835', 'f66e90fc3a1bea656c32fc843c5f373df01de8319e8ea5a6752575f90e71db45', NULL);
INSERT INTO public.sessions VALUES ('b554dbbd-f0c9-44d9-b278-e0ba8859e1b2', 43, '2026-12-02 02:33:12.087', '2026-11-25 02:33:12.087', '50c62e181335e754f3336b2cd0bafff46fa12c38100c3e39af2edf8356d09b25', NULL);


--
-- Data for Name: social_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.social_accounts VALUES (2, 52, 'google', '108123456789012345678', '2026-11-24 02:52:06.557');
INSERT INTO public.social_accounts VALUES (7, 52, 'kakao', '3812345678', '2026-11-24 02:52:11.7');
INSERT INTO public.social_accounts VALUES (9, 54, 'naver', 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d', '2026-11-24 02:52:12.07');


--
-- Data for Name: uploads; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.uploads VALUES (1, '4a858533-6237-49d9-ae3b-5b64be4b257d.jpg', 2, 14, '2026-11-24 02:52:14.097', NULL);
INSERT INTO public.uploads VALUES (12, '606f29c9-1749-4b23-b017-e900dcf90c1f.jpg', 2, 26, '2026-11-24 08:17:26.287', NULL);
INSERT INTO public.uploads VALUES (15, 'f63dc882-7992-4824-b80e-435c479baa30.jpg', 2, 28, '2026-11-24 08:19:20.791', NULL);
INSERT INTO public.uploads VALUES (16, '0f6d11bd-bc0d-4524-a4da-57ab8cd988ce.jpg', 2, 29, '2026-11-24 08:19:20.93', NULL);
INSERT INTO public.uploads VALUES (20, 'faea4bcb-af15-44b3-bce1-a8f9373ced19.jpg', 2, NULL, '2026-11-25 02:26:19.954', NULL);
INSERT INTO public.uploads VALUES (22, 'a4d4d901-9baa-4324-99b3-15c3778ac900.jpg', 2, NULL, '2026-11-25 02:28:14.475', 2);
INSERT INTO public.uploads VALUES (23, '4af900b8-1cd8-47a4-8df0-b48ee362755d.jpg', 43, 54, '2026-11-25 02:31:48.167', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES (1, 'dahye', 'https://picsum.photos/seed/dahye/40/40', NULL, NULL, NULL, NULL, NULL, 'USER');
INSERT INTO public.users VALUES (3, 'minji', 'https://picsum.photos/seed/minji/40/40', NULL, NULL, NULL, NULL, NULL, 'USER');
INSERT INTO public.users VALUES (4, 'nayeon', NULL, NULL, NULL, NULL, NULL, NULL, 'USER');
INSERT INTO public.users VALUES (5, 'seungwoo', 'https://picsum.photos/seed/seungwoo/40/40', NULL, NULL, NULL, NULL, NULL, 'USER');
INSERT INTO public.users VALUES (6, 'sora', NULL, NULL, 'sora@example.com', '한소라', NULL, NULL, 'USER');
INSERT INTO public.users VALUES (9, 'yuna', NULL, NULL, 'yuna@example.com', '김유나', NULL, NULL, 'USER');
INSERT INTO public.users VALUES (10, 'haneul', NULL, NULL, 'haneul.lee@example.com', '이하늘', NULL, NULL, 'USER');
INSERT INTO public.users VALUES (12, 'haneul2', NULL, NULL, 'haneul2@example.com', '이하늘', NULL, NULL, 'USER');
INSERT INTO public.users VALUES (13, 'dain', NULL, NULL, 'dain@example.com', '김다인', NULL, NULL, 'USER');
INSERT INTO public.users VALUES (16, 'jiho', NULL, NULL, NULL, '김지호', '01055551234', NULL, 'USER');
INSERT INTO public.users VALUES (22, 'taeyang', NULL, NULL, NULL, '한태양', '01042427777', NULL, 'USER');
INSERT INTO public.users VALUES (37, 'yuri01b', NULL, NULL, NULL, '한다른', '01051510001', NULL, 'USER');
INSERT INTO public.users VALUES (39, 'yuri02b', NULL, NULL, NULL, '한다른', '01051510002', NULL, 'USER');
INSERT INTO public.users VALUES (41, 'yuri03', NULL, NULL, NULL, '한다른', '01051510004', NULL, 'USER');
INSERT INTO public.users VALUES (44, 'doyun', NULL, NULL, 'doyun@example.com', '최도윤', NULL, '$2b$12$aPixRysEcnPdJT1.ZPKFGOP6RUZCnqaCoMd1kxS0XcmlrhVw22Fge', 'USER');
INSERT INTO public.users VALUES (47, 'jiwon', NULL, NULL, 'jiwon@example.com', '김지원', NULL, '$2b$12$nOpag4pwF0MODmUHZGJ7DuZYgf5eKEeW1fQqFyw5PUFpUGAPAOfkS', 'USER');
INSERT INTO public.users VALUES (43, 'seoyeon', NULL, NULL, 'seoyeon@example.com', '박서연', NULL, '$2b$13$gnik0yWnliyuGlwBd44F3O7DAmeLqoGI4gMxXMVlYtTWpB7NQ1bva', 'USER');
INSERT INTO public.users VALUES (48, 'boram', NULL, NULL, 'boram@example.com', '이보람', NULL, '$2b$12$KfomcfsdiNXi7qE6gW7KtOByRKegS/LjfbHSrJRk4kL4x66IL1iYK', 'USER');
INSERT INTO public.users VALUES (45, 'admin.hong', NULL, NULL, NULL, '관리자', '01077771234', '$2b$12$0mdVgn8fx7cgzq/Whrncnevn4QPML6x926zpnLrLGZqexpwAqDd4G', 'ADMIN');
INSERT INTO public.users VALUES (52, 'minji.kim', NULL, NULL, 'minji.kim@gmail.com', '김민지', NULL, NULL, 'USER');
INSERT INTO public.users VALUES (54, 'kim.minji', NULL, NULL, NULL, '김민지', NULL, NULL, 'USER');
INSERT INTO public.users VALUES (2, 'jaehoon', '/uploads/a4d4d901-9baa-4324-99b3-15c3778ac900.jpg', NULL, NULL, NULL, NULL, '$2b$12$Mjcp.XlG4IFF5U8LCJe9XepdpZ98fyPX7yFks9LHSb5am.O5sbRVq', 'USER');


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 360, true);


--
-- Name: hashtags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hashtags_id_seq', 8, true);


--
-- Name: post_hashtags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_hashtags_id_seq', 32, true);


--
-- Name: post_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_images_id_seq', 59, true);


--
-- Name: post_likes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_likes_id_seq', 11, true);


--
-- Name: posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.posts_id_seq', 54, true);


--
-- Name: social_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.social_accounts_id_seq', 9, true);


--
-- Name: uploads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.uploads_id_seq', 23, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 60, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: hashtags hashtags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hashtags
    ADD CONSTRAINT hashtags_pkey PRIMARY KEY (id);


--
-- Name: post_hashtags post_hashtags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_hashtags
    ADD CONSTRAINT post_hashtags_pkey PRIMARY KEY (id);


--
-- Name: post_images post_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: social_accounts social_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id);


--
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: hashtags_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX hashtags_name_key ON public.hashtags USING btree (name);


--
-- Name: post_hashtags_hashtag_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX post_hashtags_hashtag_id_idx ON public.post_hashtags USING btree (hashtag_id);


--
-- Name: post_hashtags_post_id_hashtag_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX post_hashtags_post_id_hashtag_id_key ON public.post_hashtags USING btree (post_id, hashtag_id);


--
-- Name: post_likes_post_id_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX post_likes_post_id_user_id_key ON public.post_likes USING btree (post_id, user_id);


--
-- Name: posts_created_at_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posts_created_at_id_idx ON public.posts USING btree (created_at DESC, id DESC);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: social_accounts_provider_provider_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX social_accounts_provider_provider_user_id_key ON public.social_accounts USING btree (provider, provider_user_id);


--
-- Name: social_accounts_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX social_accounts_user_id_idx ON public.social_accounts USING btree (user_id);


--
-- Name: social_accounts_user_id_provider_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX social_accounts_user_id_provider_key ON public.social_accounts USING btree (user_id, provider);


--
-- Name: uploads_file_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uploads_file_name_key ON public.uploads USING btree (file_name);


--
-- Name: uploads_post_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX uploads_post_id_idx ON public.uploads USING btree (post_id);


--
-- Name: uploads_profile_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uploads_profile_user_id_key ON public.uploads USING btree (profile_user_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_hashtags post_hashtags_hashtag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_hashtags
    ADD CONSTRAINT post_hashtags_hashtag_id_fkey FOREIGN KEY (hashtag_id) REFERENCES public.hashtags(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_hashtags post_hashtags_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_hashtags
    ADD CONSTRAINT post_hashtags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_images post_images_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: social_accounts social_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uploads uploads_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uploads uploads_profile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_profile_user_id_fkey FOREIGN KEY (profile_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: uploads uploads_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict mAh7sZQPkgow1U3k720oc3YnV4eTE2dO8C6ZZMPJj7XfgnIHumpowjeyCBXF3FM

