--
-- PostgreSQL database dump
--

\restrict 52FQX41p2Y60BiCZ5fiCwblVYn6vI1oV511MQb99vyk0SGV8Ju8cRTbaeUSa3J5

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
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_type AS ENUM (
    'LIKE',
    'COMMENT',
    'FOLLOW',
    'MENTION'
);


ALTER TYPE public.notification_type OWNER TO postgres;

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
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    participant_a_id integer NOT NULL,
    participant_b_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    a_cleared_at timestamp(3) without time zone,
    b_cleared_at timestamp(3) without time zone,
    last_message_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_message_id integer,
    CONSTRAINT conversations_a_before_b CHECK ((participant_a_id < participant_b_id))
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.direct_messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    sender_id integer NOT NULL,
    content character varying(1000) NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.direct_messages OWNER TO postgres;

--
-- Name: direct_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.direct_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.direct_messages_id_seq OWNER TO postgres;

--
-- Name: direct_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.direct_messages_id_seq OWNED BY public.direct_messages.id;


--
-- Name: follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follows (
    id integer NOT NULL,
    follower_id integer NOT NULL,
    following_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT follows_not_self CHECK ((follower_id <> following_id))
);


ALTER TABLE public.follows OWNER TO postgres;

--
-- Name: follows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.follows_id_seq OWNER TO postgres;

--
-- Name: follows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.follows_id_seq OWNED BY public.follows.id;


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
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    type public.notification_type NOT NULL,
    receiver_id integer NOT NULL,
    sender_id integer NOT NULL,
    post_id integer,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    post_like_id integer,
    comment_id integer,
    follow_id integer,
    CONSTRAINT notifications_one_cause CHECK ((num_nonnulls(post_like_id, comment_id, follow_id) = 1))
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


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
    role public.user_role DEFAULT 'USER'::public.user_role NOT NULL,
    follower_count integer DEFAULT 0 NOT NULL
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
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: direct_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages ALTER COLUMN id SET DEFAULT nextval('public.direct_messages_id_seq'::regclass);


--
-- Name: follows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows ALTER COLUMN id SET DEFAULT nextval('public.follows_id_seq'::regclass);


--
-- Name: hashtags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hashtags ALTER COLUMN id SET DEFAULT nextval('public.hashtags_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


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
INSERT INTO public._prisma_migrations VALUES ('ad41f8de-9929-4d61-9190-26f9866386dd', '3ca1a9198c1086a151d983a6faf3690502c535eaa7daf073155e5859cbbfcf78', '2026-11-25 10:31:44.496125+00', '20261125090402_add_follows', NULL, NULL, '2026-11-25 10:31:44.491877+00', 1);
INSERT INTO public._prisma_migrations VALUES ('89544f59-6e88-47f6-b67f-4aca6e86663e', '847325e270bdc93d577e5a6a41755576c012a451373d2075ffa805633f44de74', '2026-11-25 10:31:44.49782+00', '20261125090443_follows_not_self', NULL, NULL, '2026-11-25 10:31:44.496548+00', 1);
INSERT INTO public._prisma_migrations VALUES ('b59d1cd8-270c-4b35-944b-129076d5e6e7', '71197c0a9b3f5aa907e9baaf40a113dc4c8ed100e46abf9a2c43216123f405d8', '2026-11-25 10:31:44.499567+00', '20261125090825_add_user_follower_count', NULL, NULL, '2026-11-25 10:31:44.498323+00', 1);
INSERT INTO public._prisma_migrations VALUES ('701fb443-56cd-4355-b67d-de0dad61ba66', '673891940051690273707e9ce2b4726c1f82c1b7ba8f6ef8dba7a1bbf4b199c6', '2026-11-26 01:22:52.90939+00', '20261126005703_add_follow_list_indexes', NULL, NULL, '2026-11-26 01:22:52.904905+00', 1);
INSERT INTO public._prisma_migrations VALUES ('dd6b6851-1768-459a-8dbe-a42aac04105b', 'af1a6f1afafa8a521ecf62c863026f8f0904475017fb598a4ba80f547dd1e6e3', '2026-11-26 06:19:59.924688+00', '20261126053116_add_conversations', NULL, NULL, '2026-11-26 06:19:59.913299+00', 1);
INSERT INTO public._prisma_migrations VALUES ('0a8e73b3-318c-4b3e-a3d9-7bfed996044b', 'e8575b137fc62c972e60fac1fff75aefba57d1cc25f97e19f8bec1cd10a168d4', '2026-11-26 06:20:01.951049+00', '20261126053306_conversations_a_before_b', NULL, NULL, '2026-11-26 06:20:01.948329+00', 1);
INSERT INTO public._prisma_migrations VALUES ('23890734-75bc-4bad-bd80-5d5931266cfe', 'dd7a4e63607729b7ad02b7ab234d2e5672c2448be4105dc4ccb810468a12fac1', '2026-11-26 06:20:10.956872+00', '20261126054329_add_conversation_cleared_at', NULL, NULL, '2026-11-26 06:20:10.954266+00', 1);
INSERT INTO public._prisma_migrations VALUES ('bc742794-8585-4582-a39d-d24aa93dc6e5', 'a6f95713ca06ce72e8d8f0d8b36704d84f7ef4dc2f90ea357090872b03c6cbee', '2026-11-26 09:30:16.886642+00', '20261126084350_add_conversation_last_message', NULL, NULL, '2026-11-26 09:30:16.878746+00', 1);
INSERT INTO public._prisma_migrations VALUES ('0e8fe9ec-89cc-4dd6-8e61-c2bc782d7f79', '8759680cf06be845c73a6b471ca4a47b1e78751dd5bc5442be89b6ad57a6319b', '2026-11-27 00:29:46.814379+00', '20261127001714_add_notification_comment_follow', NULL, NULL, '2026-11-27 00:29:46.810363+00', 1);
INSERT INTO public._prisma_migrations VALUES ('df62150f-2470-4c46-9930-619812ee7a03', '5a5b2f409abbfd3e7b8e07a5e9e2c450331ea46b98ddd5a8e00ff4f2a004b8a3', '2026-11-27 00:29:39.347124+00', '20261127001435_add_notifications', NULL, NULL, '2026-11-27 00:29:39.340631+00', 1);
INSERT INTO public._prisma_migrations VALUES ('3dcd3a93-b8eb-41f7-9366-41a93175b420', '1d37a9003c492ccf13bca57553b73284f175fe4ff6cf1a53a4551aab89862872', '2026-11-27 00:29:44.592435+00', '20261127001625_add_notification_post_like', NULL, NULL, '2026-11-27 00:29:44.587708+00', 1);
INSERT INTO public._prisma_migrations VALUES ('d27e8ba3-23fd-45ff-af26-440e78f5ad53', '034c9feb09f919d29bff287f4a2bc1177cd1507773aab30f6b3f4b3a3d25d37d', '2026-11-27 00:29:46.817004+00', '20261127001715_notifications_one_cause', NULL, NULL, '2026-11-27 00:29:46.814995+00', 1);


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
INSERT INTO public.comments VALUES (361, 1, '여기 어디예요?', 0, '2026-11-27 00:29:47.778', '2026-11-27 00:29:47.778', 43, NULL);
INSERT INTO public.comments VALUES (363, 1, '한강공원이에요', 0, '2026-11-27 00:29:48.021', '2026-11-27 00:29:48.021', 2, NULL);
INSERT INTO public.comments VALUES (365, 1, '@jaehoon @doyun 다음 주에 같이 가요', 0, '2026-11-27 00:29:51.639', '2026-11-27 00:29:51.639', 43, NULL);


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.conversations VALUES (11, 2, 48, '2026-11-26 11:36:21.949', NULL, NULL, '2026-11-26 11:36:21.949', NULL);
INSERT INTO public.conversations VALUES (8, 2, 44, '2026-11-25 06:20:03.565', NULL, NULL, '2026-11-26 16:29:47.335', 87);
INSERT INTO public.conversations VALUES (7, 2, 3, '2026-11-23 06:20:03.565', NULL, NULL, '2026-11-26 16:31:05.331', 95);
INSERT INTO public.conversations VALUES (1, 2, 43, '2026-11-26 06:20:00.729', '2026-11-26 16:31:30.191', '2026-11-26 06:20:12.217', '2026-11-26 16:34:37.063', 107);


--
-- Data for Name: direct_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.direct_messages VALUES (2, 7, 2, '저녁 7시요!', false, '2026-11-24 06:20:03.565');
INSERT INTO public.direct_messages VALUES (8, 8, 2, '도윤 님, 지난번 사진 보내 드릴게요', false, '2026-11-26 07:30:44.431');
INSERT INTO public.direct_messages VALUES (9, 8, 2, '사진은 저녁에 보낼게요', false, '2026-11-26 07:30:46.179');
INSERT INTO public.direct_messages VALUES (10, 8, 2, '사진 크기는 원본 그대로 괜찮아요?', false, '2026-11-26 07:30:48.543');
INSERT INTO public.direct_messages VALUES (12, 8, 2, '방금 사진 보냈어요', false, '2026-11-26 07:30:52.785');
INSERT INTO public.direct_messages VALUES (13, 7, 2, '민지 님, 이번 주 스터디도 저녁 7시예요?', false, '2026-11-26 09:30:15.219');
INSERT INTO public.direct_messages VALUES (14, 7, 2, '장소는 지난번 그 카페예요', false, '2026-11-26 09:30:17.733');
INSERT INTO public.direct_messages VALUES (15, 7, 2, '늦으면 연락 주세요', false, '2026-11-26 09:30:19.358');
INSERT INTO public.direct_messages VALUES (19, 8, 2, '원본도 따로 보내 드릴까요?', false, '2026-11-26 09:30:28.806');
INSERT INTO public.direct_messages VALUES (21, 8, 2, '지금 보내요', false, '2026-11-26 09:30:33.901');
INSERT INTO public.direct_messages VALUES (23, 7, 2, '1번째 메시지', false, '2026-11-24 04:20:03.565');
INSERT INTO public.direct_messages VALUES (24, 7, 2, '2번째 메시지', false, '2026-11-24 04:21:03.565');
INSERT INTO public.direct_messages VALUES (25, 7, 2, '3번째 메시지', false, '2026-11-24 04:22:03.565');
INSERT INTO public.direct_messages VALUES (29, 7, 2, '7번째 메시지', false, '2026-11-24 04:26:03.565');
INSERT INTO public.direct_messages VALUES (30, 7, 2, '8번째 메시지', false, '2026-11-24 04:27:03.565');
INSERT INTO public.direct_messages VALUES (31, 7, 2, '9번째 메시지', false, '2026-11-24 04:28:03.565');
INSERT INTO public.direct_messages VALUES (35, 7, 2, '13번째 메시지', false, '2026-11-24 04:32:03.565');
INSERT INTO public.direct_messages VALUES (36, 7, 2, '14번째 메시지', false, '2026-11-24 04:33:03.565');
INSERT INTO public.direct_messages VALUES (37, 7, 2, '15번째 메시지', false, '2026-11-24 04:34:03.565');
INSERT INTO public.direct_messages VALUES (41, 7, 2, '19번째 메시지', false, '2026-11-24 04:38:03.565');
INSERT INTO public.direct_messages VALUES (42, 7, 2, '20번째 메시지', false, '2026-11-24 04:39:03.565');
INSERT INTO public.direct_messages VALUES (43, 7, 2, '21번째 메시지', false, '2026-11-24 04:40:03.565');
INSERT INTO public.direct_messages VALUES (47, 7, 2, '25번째 메시지', false, '2026-11-24 04:44:03.565');
INSERT INTO public.direct_messages VALUES (48, 7, 2, '26번째 메시지', false, '2026-11-24 04:45:03.565');
INSERT INTO public.direct_messages VALUES (49, 7, 2, '27번째 메시지', false, '2026-11-24 04:46:03.565');
INSERT INTO public.direct_messages VALUES (53, 7, 2, '31번째 메시지', false, '2026-11-24 04:50:03.565');
INSERT INTO public.direct_messages VALUES (54, 7, 2, '32번째 메시지', false, '2026-11-24 04:51:03.565');
INSERT INTO public.direct_messages VALUES (55, 7, 2, '33번째 메시지', false, '2026-11-24 04:52:03.565');
INSERT INTO public.direct_messages VALUES (59, 7, 2, '37번째 메시지', false, '2026-11-24 04:56:03.565');
INSERT INTO public.direct_messages VALUES (60, 7, 2, '38번째 메시지', false, '2026-11-24 04:57:03.565');
INSERT INTO public.direct_messages VALUES (61, 7, 2, '39번째 메시지', false, '2026-11-24 04:58:03.565');
INSERT INTO public.direct_messages VALUES (65, 7, 2, '43번째 메시지', false, '2026-11-24 05:02:03.565');
INSERT INTO public.direct_messages VALUES (66, 7, 2, '44번째 메시지', false, '2026-11-24 05:03:03.565');
INSERT INTO public.direct_messages VALUES (67, 7, 2, '45번째 메시지', false, '2026-11-24 05:04:03.565');
INSERT INTO public.direct_messages VALUES (71, 7, 2, '49번째 메시지', false, '2026-11-24 05:08:03.565');
INSERT INTO public.direct_messages VALUES (72, 7, 2, '50번째 메시지', false, '2026-11-24 05:09:03.565');
INSERT INTO public.direct_messages VALUES (73, 7, 2, '51번째 메시지', false, '2026-11-24 05:10:03.565');
INSERT INTO public.direct_messages VALUES (77, 7, 2, '55번째 메시지', false, '2026-11-24 05:14:03.565');
INSERT INTO public.direct_messages VALUES (78, 7, 2, '56번째 메시지', false, '2026-11-24 05:15:03.565');
INSERT INTO public.direct_messages VALUES (79, 7, 2, '57번째 메시지', false, '2026-11-24 05:16:03.565');
INSERT INTO public.direct_messages VALUES (83, 7, 2, '이번 주 스터디 자료는 제가 준비할게요', false, '2026-11-26 11:35:30.379');
INSERT INTO public.direct_messages VALUES (87, 8, 2, '원본은 메일로 보내 드릴게요', false, '2026-11-26 16:29:47.335');
INSERT INTO public.direct_messages VALUES (90, 7, 2, '자료 링크는 저녁에 올릴게요', false, '2026-11-26 16:30:18.967');
INSERT INTO public.direct_messages VALUES (91, 7, 2, '발표 순서는 제가 정해 둘게요', false, '2026-11-26 16:30:38.462');
INSERT INTO public.direct_messages VALUES (94, 7, 2, '자료는 금요일까지 올릴게요', false, '2026-11-26 16:30:59.796');
INSERT INTO public.direct_messages VALUES (95, 7, 2, '발표 자료도 같이 올릴게요', false, '2026-11-26 16:31:05.331');
INSERT INTO public.direct_messages VALUES (1, 7, 3, '다음 주 스터디 몇 시에 해요?', true, '2026-11-24 05:20:03.565');
INSERT INTO public.direct_messages VALUES (26, 7, 3, '4번째 메시지', true, '2026-11-24 04:23:03.565');
INSERT INTO public.direct_messages VALUES (27, 7, 3, '5번째 메시지', true, '2026-11-24 04:24:03.565');
INSERT INTO public.direct_messages VALUES (28, 7, 3, '6번째 메시지', true, '2026-11-24 04:25:03.565');
INSERT INTO public.direct_messages VALUES (32, 7, 3, '10번째 메시지', true, '2026-11-24 04:29:03.565');
INSERT INTO public.direct_messages VALUES (33, 7, 3, '11번째 메시지', true, '2026-11-24 04:30:03.565');
INSERT INTO public.direct_messages VALUES (34, 7, 3, '12번째 메시지', true, '2026-11-24 04:31:03.565');
INSERT INTO public.direct_messages VALUES (38, 7, 3, '16번째 메시지', true, '2026-11-24 04:35:03.565');
INSERT INTO public.direct_messages VALUES (39, 7, 3, '17번째 메시지', true, '2026-11-24 04:36:03.565');
INSERT INTO public.direct_messages VALUES (40, 7, 3, '18번째 메시지', true, '2026-11-24 04:37:03.565');
INSERT INTO public.direct_messages VALUES (44, 7, 3, '22번째 메시지', true, '2026-11-24 04:41:03.565');
INSERT INTO public.direct_messages VALUES (45, 7, 3, '23번째 메시지', true, '2026-11-24 04:42:03.565');
INSERT INTO public.direct_messages VALUES (46, 7, 3, '24번째 메시지', true, '2026-11-24 04:43:03.565');
INSERT INTO public.direct_messages VALUES (50, 7, 3, '28번째 메시지', true, '2026-11-24 04:47:03.565');
INSERT INTO public.direct_messages VALUES (51, 7, 3, '29번째 메시지', true, '2026-11-24 04:48:03.565');
INSERT INTO public.direct_messages VALUES (52, 7, 3, '30번째 메시지', true, '2026-11-24 04:49:03.565');
INSERT INTO public.direct_messages VALUES (56, 7, 3, '34번째 메시지', true, '2026-11-24 04:53:03.565');
INSERT INTO public.direct_messages VALUES (57, 7, 3, '35번째 메시지', true, '2026-11-24 04:54:03.565');
INSERT INTO public.direct_messages VALUES (58, 7, 3, '36번째 메시지', true, '2026-11-24 04:55:03.565');
INSERT INTO public.direct_messages VALUES (18, 8, 44, '사진 잘 받았어요!', true, '2026-11-26 09:30:27.143');
INSERT INTO public.direct_messages VALUES (20, 8, 44, '네, 부탁해요', true, '2026-11-26 09:30:29.308');
INSERT INTO public.direct_messages VALUES (22, 8, 44, '고마워요!', true, '2026-11-26 09:30:34.404');
INSERT INTO public.direct_messages VALUES (16, 1, 43, '잘 지내요?', true, '2026-11-26 09:30:23.321');
INSERT INTO public.direct_messages VALUES (17, 1, 43, '주말에 시간 있어요?', true, '2026-11-26 09:30:26.872');
INSERT INTO public.direct_messages VALUES (85, 1, 43, '저는 좋아요!', true, '2026-11-26 16:29:40.832');
INSERT INTO public.direct_messages VALUES (86, 1, 43, '장소는 어디가 좋아요?', true, '2026-11-26 16:29:45.13');
INSERT INTO public.direct_messages VALUES (88, 1, 43, '강남역 어때요?', true, '2026-11-26 16:29:49.475');
INSERT INTO public.direct_messages VALUES (89, 1, 43, '그럼 강남역에서 봬요', true, '2026-11-26 16:30:02.126');
INSERT INTO public.direct_messages VALUES (96, 1, 43, '네, 좋아요!', true, '2026-11-26 16:31:21.231');
INSERT INTO public.direct_messages VALUES (97, 1, 43, '방을 지우셨나 봐요', true, '2026-11-26 16:31:25.782');
INSERT INTO public.direct_messages VALUES (98, 1, 43, '다시 보내 볼게요', true, '2026-11-26 16:31:38.893');
INSERT INTO public.direct_messages VALUES (99, 1, 43, '지금 출발해요', true, '2026-11-26 16:32:05.217');
INSERT INTO public.direct_messages VALUES (84, 1, 2, '토요일 오후 두 시 어때요?', true, '2026-11-26 11:35:56.702');
INSERT INTO public.direct_messages VALUES (92, 1, 2, '시간은 두 시 그대로죠?', true, '2026-11-26 16:30:42.772');
INSERT INTO public.direct_messages VALUES (93, 1, 2, '혹시 늦으면 연락 주세요', true, '2026-11-26 16:30:53.209');
INSERT INTO public.direct_messages VALUES (62, 7, 3, '40번째 메시지', true, '2026-11-24 04:59:03.565');
INSERT INTO public.direct_messages VALUES (63, 7, 3, '41번째 메시지', true, '2026-11-24 05:00:03.565');
INSERT INTO public.direct_messages VALUES (64, 7, 3, '42번째 메시지', true, '2026-11-24 05:01:03.565');
INSERT INTO public.direct_messages VALUES (68, 7, 3, '46번째 메시지', true, '2026-11-24 05:05:03.565');
INSERT INTO public.direct_messages VALUES (69, 7, 3, '47번째 메시지', true, '2026-11-24 05:06:03.565');
INSERT INTO public.direct_messages VALUES (70, 7, 3, '48번째 메시지', true, '2026-11-24 05:07:03.565');
INSERT INTO public.direct_messages VALUES (74, 7, 3, '52번째 메시지', true, '2026-11-24 05:11:03.565');
INSERT INTO public.direct_messages VALUES (75, 7, 3, '53번째 메시지', true, '2026-11-24 05:12:03.565');
INSERT INTO public.direct_messages VALUES (76, 7, 3, '54번째 메시지', true, '2026-11-24 05:13:03.565');
INSERT INTO public.direct_messages VALUES (80, 7, 3, '58번째 메시지', true, '2026-11-24 05:17:03.565');
INSERT INTO public.direct_messages VALUES (81, 7, 3, '59번째 메시지', true, '2026-11-24 05:18:03.565');
INSERT INTO public.direct_messages VALUES (82, 7, 3, '60번째 메시지', true, '2026-11-24 05:19:03.565');
INSERT INTO public.direct_messages VALUES (100, 1, 43, '도착하면 연락할게요', true, '2026-11-26 16:32:24.299');
INSERT INTO public.direct_messages VALUES (101, 1, 2, '저도 지금 나가요', true, '2026-11-26 16:32:37.052');
INSERT INTO public.direct_messages VALUES (102, 1, 2, '먼저 도착하면 자리 잡을게요', true, '2026-11-26 16:32:39.011');
INSERT INTO public.direct_messages VALUES (103, 1, 43, '거의 다 왔어요!', true, '2026-11-26 16:32:58.708');
INSERT INTO public.direct_messages VALUES (104, 1, 43, '방금 메시지 받았어요?', true, '2026-11-26 16:33:15.424');
INSERT INTO public.direct_messages VALUES (105, 1, 43, '답장 기다릴게요', true, '2026-11-26 16:33:16.402');
INSERT INTO public.direct_messages VALUES (106, 1, 43, '이번에는 보여요?', true, '2026-11-26 16:34:09.371');
INSERT INTO public.direct_messages VALUES (107, 1, 43, '이번엔 바로 보이죠?', true, '2026-11-26 16:34:37.063');


--
-- Data for Name: follows; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.follows VALUES (3, 45, 3, '2026-11-20 08:00:00');
INSERT INTO public.follows VALUES (4, 48, 3, '2026-11-20 07:00:00');
INSERT INTO public.follows VALUES (5, 1, 3, '2026-11-20 06:00:00');
INSERT INTO public.follows VALUES (6, 13, 3, '2026-11-20 05:00:00');
INSERT INTO public.follows VALUES (7, 44, 3, '2026-11-20 04:00:00');
INSERT INTO public.follows VALUES (8, 10, 3, '2026-11-20 03:00:00');
INSERT INTO public.follows VALUES (9, 12, 3, '2026-11-20 02:00:00');
INSERT INTO public.follows VALUES (10, 16, 3, '2026-11-20 01:00:00');
INSERT INTO public.follows VALUES (11, 47, 3, '2026-11-20 00:00:00');
INSERT INTO public.follows VALUES (12, 54, 3, '2026-11-19 23:00:00');
INSERT INTO public.follows VALUES (13, 52, 3, '2026-11-19 22:00:00');
INSERT INTO public.follows VALUES (14, 4, 3, '2026-11-19 21:00:00');
INSERT INTO public.follows VALUES (15, 43, 3, '2026-11-19 20:00:00');
INSERT INTO public.follows VALUES (16, 5, 3, '2026-11-19 19:00:00');
INSERT INTO public.follows VALUES (17, 6, 3, '2026-11-19 18:00:00');
INSERT INTO public.follows VALUES (18, 22, 3, '2026-11-19 17:00:00');
INSERT INTO public.follows VALUES (19, 9, 3, '2026-11-19 16:00:00');
INSERT INTO public.follows VALUES (20, 37, 3, '2026-11-19 15:00:00');
INSERT INTO public.follows VALUES (21, 39, 3, '2026-11-19 14:00:00');
INSERT INTO public.follows VALUES (22, 41, 3, '2026-11-19 13:00:00');
INSERT INTO public.follows VALUES (24, 43, 2, '2026-11-05 09:00:00');
INSERT INTO public.follows VALUES (25, 48, 2, '2026-11-03 09:00:00');
INSERT INTO public.follows VALUES (26, 2, 4, '2026-11-06 09:00:00');
INSERT INTO public.follows VALUES (28, 2, 5, '2026-11-08 09:00:00');
INSERT INTO public.follows VALUES (29, 2, 1, '2026-11-09 09:00:00');
INSERT INTO public.follows VALUES (30, 3, 5, '2026-10-31 09:00:00');
INSERT INTO public.follows VALUES (31, 3, 1, '2026-11-01 09:00:00');
INSERT INTO public.follows VALUES (32, 3, 2, '2026-11-02 09:00:00');
INSERT INTO public.follows VALUES (34, 2, 3, '2026-11-25 10:31:45.208');
INSERT INTO public.follows VALUES (35, 43, 44, '2026-11-25 10:31:45.622');
INSERT INTO public.follows VALUES (36, 2, 44, '2026-11-25 10:31:45.628');
INSERT INTO public.follows VALUES (37, 2, 45, '2026-11-26 01:23:14.429');
INSERT INTO public.follows VALUES (39, 2, 48, '2026-11-26 01:23:25.896');
INSERT INTO public.follows VALUES (42, 44, 2, '2026-11-27 00:29:48.314');


--
-- Data for Name: hashtags; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.hashtags VALUES (6, '한강', 1);
INSERT INTO public.hashtags VALUES (1, '바다', 1);
INSERT INTO public.hashtags VALUES (4, 'sunset', 0);
INSERT INTO public.hashtags VALUES (2, '노을', 27);


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.notifications VALUES (5, 'LIKE', 2, 43, 1, false, '2026-11-27 00:29:45.613', 18, NULL, NULL);
INSERT INTO public.notifications VALUES (6, 'COMMENT', 2, 43, 1, false, '2026-11-27 00:29:47.783', NULL, 361, NULL);
INSERT INTO public.notifications VALUES (9, 'FOLLOW', 2, 44, NULL, false, '2026-11-27 00:29:48.315', NULL, NULL, 42);
INSERT INTO public.notifications VALUES (13, 'COMMENT', 2, 43, 1, false, '2026-11-27 00:29:51.641', NULL, 365, NULL);
INSERT INTO public.notifications VALUES (14, 'MENTION', 44, 43, 1, false, '2026-11-27 00:29:51.646', NULL, 365, NULL);


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
INSERT INTO public.post_likes VALUES (16, 26, 2);
INSERT INTO public.post_likes VALUES (18, 1, 43);


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.posts VALUES (3, '농구 코트', '주말마다 여기 옵니다', 76, 2, '2026-11-23 23:51:27.055', '2026-11-23 23:51:27.055', 5);
INSERT INTO public.posts VALUES (4, '새 렌즈', '새로 산 렌즈로 찍어봤어요', 205, 0, '2026-11-23 21:51:27.058', '2026-11-23 21:51:27.058', 3);
INSERT INTO public.posts VALUES (5, '저녁 산책', '동네 한 바퀴', 34, 0, '2026-11-23 19:51:27.06', '2026-11-23 19:51:27.06', 1);
INSERT INTO public.posts VALUES (9, '제주도 바다 사진', '제주 왔어요 🌊', 1, 0, '2026-11-24 02:51:27.994', '2026-11-24 02:51:27.994', 3);
INSERT INTO public.posts VALUES (14, '바다에 다녀왔어요', '주말에 바다에 다녀왔어요', 1, 0, '2026-11-24 02:52:14.097', '2026-11-24 02:52:33.674', 2);
INSERT INTO public.posts VALUES (2, '갓 구운 크루아상', '오늘 아침에 구운 크루아상', 513, 39, '2026-11-24 02:06:27.051', '2026-11-24 06:13:39.042', 3);
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
INSERT INTO public.posts VALUES (54, '처음 올린 글이에요', '처음 올린 글이에요', 0, 0, '2026-11-25 02:31:48.191', '2026-11-25 02:31:48.191', 43);
INSERT INTO public.posts VALUES (26, '', '#노을빛 하늘이 오래 남았어요 #한강', 1, 0, '2026-11-24 08:17:26.372', '2026-11-24 08:17:26.372', 2);
INSERT INTO public.posts VALUES (1, '노을 진 한강', '퇴근길에 한강이 너무 예뻤어요 #노을 #한강', 132, 7, '2026-11-24 02:39:27.04', '2026-11-24 08:20:23.409', 2);


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
INSERT INTO public.sessions VALUES ('b2c1675e-4cc5-4352-92b3-3680a480aea3', 2, '2026-12-02 10:31:45.138', '2026-11-25 10:31:45.141', 'fa22c0b6d899e3c8dae31f6e3e3574f277c8041491f26c84679376c20174bab6', NULL);
INSERT INTO public.sessions VALUES ('0b19a459-73ff-4001-800c-f708238be33d', 43, '2026-12-02 10:31:45.615', '2026-11-25 10:31:45.615', 'fda62f9e385d63a266ba4688d8d650389388c2b8e9091bf478c6f11019c2e758', NULL);
INSERT INTO public.sessions VALUES ('70b0f5f1-ff2a-4e31-bdc9-1d36e3a76a3e', 2, '2026-12-03 01:23:02.638', '2026-11-26 01:23:02.642', '8497a8465153b6393638430ba6586610539f49730eba5909c099a46a5cbf4feb', NULL);
INSERT INTO public.sessions VALUES ('7889e9ee-ece0-4aae-a1e4-4668d955492c', 2, '2026-12-03 01:23:11.762', '2026-11-26 01:23:11.765', 'dd22c85788c6a563d50401468c52d70bff467066d92f32e3ea20b18f1aa1ba98', NULL);
INSERT INTO public.sessions VALUES ('69f83e44-e03c-4fb3-bcfc-da0250e554fe', 2, '2026-12-03 01:23:23.227', '2026-11-26 01:23:23.23', '1ae7c189a37225bdb9212d22da93fdcb20f1f95ce10b688c433d588644de55ee', NULL);
INSERT INTO public.sessions VALUES ('0f029b60-942d-4326-a3cf-92dd8cd3a016', 2, '2026-12-03 01:23:36.24', '2026-11-26 01:23:36.245', '8658ff18d2a0830332f11049c90de10aeb0c6fe2906fddc381dc224f0f1de9cb', NULL);
INSERT INTO public.sessions VALUES ('ff9d96dc-190d-4923-a98d-b3fb9008b8fb', 2, '2026-12-03 01:23:48.422', '2026-11-26 01:23:48.425', '7cc46704f2eaabbf98d3255d4d196f9c8cf907b188a2115f369d589e01db0008', NULL);
INSERT INTO public.sessions VALUES ('fb35084e-d1a3-4149-be04-6ddc2e83e3cf', 2, '2026-12-03 06:20:00.71', '2026-11-26 06:20:00.714', '9079fbd3768a60dc30cf29480ea12882787c7061fb0feefdba4707d1d89d2ef8', NULL);
INSERT INTO public.sessions VALUES ('b1b2e3ad-66ff-4ed3-9e58-7539a2f83d09', 43, '2026-12-03 06:20:01.204', '2026-11-26 06:20:01.204', 'cb464cfd95421ac280e537294a8051ccef31c8d5b08f6923962ea3877df2a7af', NULL);
INSERT INTO public.sessions VALUES ('0aa40556-832f-41ec-998b-b59ad96c3ba5', 2, '2026-12-03 06:20:02.728', '2026-11-26 06:20:02.732', '46dff4e9806e89d35833909dc1daa99dbab6fbd823bd12f3222d7a78309093b9', NULL);
INSERT INTO public.sessions VALUES ('5479b24a-684c-4b02-b842-b377ffa1ba3e', 43, '2026-12-03 06:20:03.303', '2026-11-26 06:20:03.304', '17dea3b3787291d00bf7467988ae9c5302e2e4a8f14ebc94b8e2476215070ae6', NULL);
INSERT INTO public.sessions VALUES ('74789f08-807b-4600-a346-665625685989', 2, '2026-12-03 06:20:06.267', '2026-11-26 06:20:06.271', '4da6fda675db8e9a562bde3db42f8af02cb594222691a154bfd63192cc434010', NULL);
INSERT INTO public.sessions VALUES ('3461c8c1-08a0-415b-ac99-173a337b976c', 48, '2026-12-03 06:20:07.815', '2026-11-26 06:20:07.819', '32b03a182e4191a63bcb7caa67ca21a5a10c1ca444ee93efad37321fe66c0ef9', NULL);
INSERT INTO public.sessions VALUES ('a891b24d-661e-4aee-b1e6-542f9205b0b7', 43, '2026-12-03 06:20:09.571', '2026-11-26 06:20:09.575', '4d18ff40dcd2531fe8b243a49f929aee46e3635d65f2c00f3efb9de84254bc08', NULL);
INSERT INTO public.sessions VALUES ('ab2c9316-0c3d-40ba-a344-d35d188bd4f7', 2, '2026-12-03 06:20:11.721', '2026-11-26 06:20:11.725', '010673ce0d9017fbba766f5d59921e18a574dbd00446cea0c0da0ea912021352', NULL);
INSERT INTO public.sessions VALUES ('9eb3b7b3-524a-4380-8748-8ac1f90e91a2', 43, '2026-12-03 06:20:12.208', '2026-11-26 06:20:12.208', '63bebca858f7e7335a386120b7cc38bb85521c1252d2f74eea6a0fb016fd2f1f', NULL);
INSERT INTO public.sessions VALUES ('0992edec-eb65-4f7b-8a4f-93ce54396040', 2, '2026-12-03 07:30:44.166', '2026-11-26 07:30:44.169', 'e1e55084b3e6907c7dd2d8a45dd8612e5d414e44a0f37945e795c9bb4ba9006e', NULL);
INSERT INTO public.sessions VALUES ('248e2601-9504-4823-8638-4a678b6347a7', 44, '2026-12-03 07:30:44.419', '2026-11-26 07:30:44.419', 'c25ef95f86c3e18282dac0df1bc2e6bba7b87679e8e9081fec04cdf02a1bca1a', NULL);
INSERT INTO public.sessions VALUES ('ee215dfd-a66c-4f7d-86ca-ac0432a4310a', 48, '2026-12-03 07:30:46.168', '2026-11-26 07:30:46.168', '49e9eab8b7db49363ce4627cb391d7c61e12f7a21eaf48840c84068031c15494', NULL);
INSERT INTO public.sessions VALUES ('5eb15616-d25a-451e-9910-356b29e021e1', 2, '2026-12-03 07:30:48.286', '2026-11-26 07:30:48.29', 'efe9da0ec59e9f8e45eee64ef62dbdb1ae30983104dd6bef1d79908516aea070', NULL);
INSERT INTO public.sessions VALUES ('cb96041d-6a07-4cc1-a0c1-b17ef7b68793', 48, '2026-12-03 07:30:48.53', '2026-11-26 07:30:48.531', 'c3027a19db81b1b9ceb6fe371bcb8881b121df84fe350a58a91ca9c9e25f9e8f', NULL);
INSERT INTO public.sessions VALUES ('3b961bc1-cf3a-4f92-b9d3-c21499940f52', 48, '2026-12-03 07:30:50.679', '2026-11-26 07:30:50.684', 'a0542a7b5c9c51f6f9c6f04328474ef0a96ab9f30b6c8fe89c88af00961e652f', NULL);
INSERT INTO public.sessions VALUES ('21cf10ba-eb18-40ac-a44c-1ec0c702b292', 48, '2026-12-03 07:30:52.52', '2026-11-26 07:30:52.525', '837cec0ce93de9c518f5a963b73b3aeb96abfb0938502d6c6ec5dc5153c33970', NULL);
INSERT INTO public.sessions VALUES ('7267ed4f-dd51-4134-b37a-99b235982e68', 2, '2026-12-03 07:30:52.766', '2026-11-26 07:30:52.766', '8e73ec8c07ae90d8ac051bdbf8cc2f688ebb6ad7fc4b0f3edfcb8d74e8c183f7', NULL);
INSERT INTO public.sessions VALUES ('c69ceb5e-d1e6-482a-9a2b-49b364e671a7', 2, '2026-12-03 09:30:15.183', '2026-11-26 09:30:15.188', '0cf1a6a92fc1d0e7ddb8dbf21a8a4a0d387c1b5f838fdf15af7c03a866b33549', NULL);
INSERT INTO public.sessions VALUES ('39c36379-3885-4420-9f38-a4a5e4d6cbd6', 2, '2026-12-03 09:30:15.449', '2026-11-26 09:30:15.449', 'c7f561f066fd1a3b644bef1f28aea27c8817c7c1b7c5d8fe3b36d84309ed7702', NULL);
INSERT INTO public.sessions VALUES ('270e285d-f86e-48c8-80b4-64680d33b03c', 2, '2026-12-03 09:30:17.707', '2026-11-26 09:30:17.712', 'c97bf0da84aa6165612bbc20f4c7dc1be88475b0c330e7530b8ca97c490bfd2a', NULL);
INSERT INTO public.sessions VALUES ('25ceb885-d26b-4bd7-a5d5-7eb9c8c67906', 2, '2026-12-03 09:30:19.333', '2026-11-26 09:30:19.336', '9640373a1bf6bf5236db0f7f4363a0f7ec8f9eee7dc2d2424676c730b8dfcf62', NULL);
INSERT INTO public.sessions VALUES ('aee7ba8f-fc07-428f-a613-69f877655d8b', 2, '2026-12-03 09:30:19.604', '2026-11-26 09:30:19.604', 'f4ac61c57f35e9fa7156be8e0bbc41a5629dd1082406c7a818c3b65b5a37fda5', NULL);
INSERT INTO public.sessions VALUES ('8b4e1026-2fe9-40ed-afb7-2cd4b7899275', 2, '2026-12-03 09:30:21.214', '2026-11-26 09:30:21.218', '5a6cc649909007807eb9b20aaeb8f8c6fcb1aaa98cb0748abfda3394b96250ad', NULL);
INSERT INTO public.sessions VALUES ('6713481f-8a7a-4fe8-aa6d-be14e25d5686', 2, '2026-12-03 09:30:22.826', '2026-11-26 09:30:22.83', '75406159db97c0bed5f047eb679376ff051ba3a3f98960904095115d5c9dc059', NULL);
INSERT INTO public.sessions VALUES ('77285157-cd72-40bd-a51b-43d6c42b9c53', 43, '2026-12-03 09:30:23.299', '2026-11-26 09:30:23.299', 'fd3bd62aaa276e74251a8e2418843758aebe768e95b434dbba8d3a64296e65f0', NULL);
INSERT INTO public.sessions VALUES ('d0efb1ee-c1d2-4b36-9495-843feaece24f', 2, '2026-12-03 09:30:24.696', '2026-11-26 09:30:24.7', '70b5ebdbd1d8ada6298a3c7cd1625a0d2704d59049f7d0b85427030119168f29', NULL);
INSERT INTO public.sessions VALUES ('7e55da55-0a3a-4873-bbcc-836a0967e597', 2, '2026-12-03 09:30:26.355', '2026-11-26 09:30:26.359', '6c451db7c645fec7cb35d56d36126f7d9c83c4a70fb34a268d3c5b084fef26b6', NULL);
INSERT INTO public.sessions VALUES ('1918cc58-cd3c-45cb-a3b1-fe9b51fbb0c8', 43, '2026-12-03 09:30:26.85', '2026-11-26 09:30:26.851', 'c94effea7bc73afc834d3c6f7678ab99fc9ab6817d7c9a35f726614e7a1b42c3', NULL);
INSERT INTO public.sessions VALUES ('a18114e6-e06e-4a55-a71d-75675b6e3067', 44, '2026-12-03 09:30:27.128', '2026-11-26 09:30:27.128', '1f87b32bdc29996db8df1319ff71171ed0f6815c3464abbc9294eac2001dd2bd', NULL);
INSERT INTO public.sessions VALUES ('f4fd9e92-1a98-44ac-8bb0-75eaf9c0f1af', 2, '2026-12-03 09:30:28.538', '2026-11-26 09:30:28.542', 'f789b1bf1dc3f3d1f5de5687ecaadc3d5f4465c0fb185d23f1ee49fb36b7dc28', NULL);
INSERT INTO public.sessions VALUES ('c207a89f-f588-49ce-9198-6890ce44111e', 44, '2026-12-03 09:30:28.787', '2026-11-26 09:30:28.787', '08710e38158ab86a676ae99f1bc0b416c124c1e0445702994d2e0c022a7e25b6', NULL);
INSERT INTO public.sessions VALUES ('72da485d-7910-49d5-b5ca-6c8c7457d5d7', 2, '2026-12-03 09:30:32.052', '2026-11-26 09:30:32.052', '86df0be90e132d363de8728387bb0dfcacba2442c11477edad6abd39aba7efd9', NULL);
INSERT INTO public.sessions VALUES ('6b43a8fc-eff7-44f9-b2f6-71e6503b5eda', 2, '2026-12-03 09:30:33.635', '2026-11-26 09:30:33.64', '0ce09419726c0eed2c0ff217226016945317b2e81781ed571b5a0f8122e835a7', NULL);
INSERT INTO public.sessions VALUES ('3c83552a-5224-49bc-b5a9-e9939195e1bc', 44, '2026-12-03 09:30:33.883', '2026-11-26 09:30:33.883', '060f9760241e040f7f8d2bc4899ef3fa52e86aa4235119b5aec1340e323fad85', NULL);
INSERT INTO public.sessions VALUES ('c0fb9534-1d67-439b-ad81-a7e6e5242364', 2, '2026-12-03 09:30:37.146', '2026-11-26 09:30:37.146', '0dadf8285a8bd60036a219fb76a2be38e1332afb61d670dfc7fc6059291427e7', NULL);
INSERT INTO public.sessions VALUES ('083799ee-0f08-419c-b00a-30c1de80723e', 2, '2026-12-03 09:30:38.545', '2026-11-26 09:30:38.549', 'fe11a80e84ed48151d212b1a03c51edd95b1865a58d7f6e17060445e1ffb55e2', NULL);
INSERT INTO public.sessions VALUES ('ff43ed21-e70e-493b-949b-0fe7cc2412ff', 2, '2026-12-03 11:24:48.891', '2026-11-26 11:24:48.891', '4c09903f9f0402e88831d0b40dc8cf2db7045da2ef9940005a1286dba0f44f43', NULL);
INSERT INTO public.sessions VALUES ('92a0ef75-b0c4-494b-9586-f73d263f1f07', 43, '2026-12-03 11:35:49.934', '2026-11-26 11:35:49.934', '75de5211027f00f6906b3d8ff6a2a96156805321143ba87e78354fe4d72a2782', NULL);
INSERT INTO public.sessions VALUES ('b00ee562-b0f1-44a8-afbc-6e0b32262004', 48, '2026-12-03 11:48:38.382', '2026-11-26 11:48:38.382', '841ad4bad840366c7f7854c288e013fc1b19136e5b2db83f4c52b8713efc14fd', NULL);
INSERT INTO public.sessions VALUES ('d6214664-1e4a-42c2-972f-71d9cd7ff64e', 2, '2026-12-03 11:48:45.363', '2026-11-26 11:22:06.942', '114d7a02ef129127d9ae66dac98e431d927c554b38b05e18dc31ebbfe9242b5e', '07e863c649c00903cb5b230609a84ca30b5777b54448ee6d9db40e3611cb9690');
INSERT INTO public.sessions VALUES ('8af5ac84-2e17-48c1-aea5-b310ddd0df92', 43, '2026-12-03 16:29:36.093', '2026-11-26 16:29:36.096', '9ceb1db46729bb7e0f9482cd08feedf8e7eef4ccb39608f9e8560d4e2deea0bf', NULL);
INSERT INTO public.sessions VALUES ('2b691a4f-a4be-4c13-aff0-edbaec3d2182', 2, '2026-12-03 16:29:38.949', '2026-11-26 16:29:38.949', '7e5e3db2807be3cc1d459cc3423bfb44c13e868ff130e438a9d697a583e28381', NULL);
INSERT INTO public.sessions VALUES ('63347517-e276-4081-a97b-1cd38182f6a6', 43, '2026-12-03 16:29:57.229', '2026-11-26 16:29:57.231', '446bf1358844b99659eb56a06366724b7e8f5718138d627452e24586e1bd3e74', NULL);
INSERT INTO public.sessions VALUES ('1a5607d7-22e6-42f4-850a-1c7366d66bb3', 2, '2026-12-03 16:30:00.277', '2026-11-26 16:30:00.277', '9e435c07d5b983548f71054a774bad6465e323ef7bcd7693a12adef72f642b2b', NULL);
INSERT INTO public.sessions VALUES ('4e61d30c-afaa-4c6e-8077-bd02509de529', 2, '2026-12-03 16:30:07.927', '2026-11-26 16:30:07.93', 'f49e3b63395c50dd0cece0f86f5e4cd7e01c760096fb388b3ce9638054321f4a', NULL);
INSERT INTO public.sessions VALUES ('6378c5f1-6262-4332-b9af-5cf76096524b', 2, '2026-12-03 16:30:27.022', '2026-11-26 16:30:27.025', '8ae0d01b02394fb5b1c76f3e5684187c2a0e9fc3cddad7091a0a0775bf9023f0', NULL);
INSERT INTO public.sessions VALUES ('cd06d75c-4ecd-4578-b073-b8599142726e', 2, '2026-12-03 16:30:50.773', '2026-11-26 16:30:50.775', 'a44971a2c7eaad1a6754ff9ed4df4b1887ef7dff8ef4c08b52a148e40dfa5f74', NULL);
INSERT INTO public.sessions VALUES ('03d6118c-1218-42c1-9a76-845e95faa12d', 43, '2026-12-03 16:31:16.585', '2026-11-26 16:31:16.588', '9a503188a0b0c754e132dc8da4fbd5b7582ff6be8667370340b03abcacc24f66', NULL);
INSERT INTO public.sessions VALUES ('a16e698b-588c-4add-94e6-489090a7be6e', 2, '2026-12-03 16:31:19.381', '2026-11-26 16:31:19.381', '8bd123b0c4a42747560f09602b282be2d962997acacc4ecc446af3bd2865b32b', NULL);
INSERT INTO public.sessions VALUES ('835fba84-165c-4c5b-9b5a-755ca8f7ba33', 2, '2026-12-03 16:31:23.957', '2026-11-26 16:31:23.957', '74f526da161b3fd2d9386db15841a62a7245dcebe0b60820eeab4b78749472d2', NULL);
INSERT INTO public.sessions VALUES ('aefc2484-5d60-46bf-bbc6-26c908c7a0b0', 2, '2026-12-03 16:31:30.179', '2026-11-26 16:31:30.182', '869baa343fe2f4e27c378547ba7b38ccef6d6cf87328043728de32706219c021', NULL);
INSERT INTO public.sessions VALUES ('45c53778-df9d-4930-918f-79e628472293', 43, '2026-12-03 16:31:34.252', '2026-11-26 16:31:34.252', 'c656468c7b1219ecf927b85b4dd581a845ca9ed5fbe8cce6eeb8f39d02d34da4', NULL);
INSERT INTO public.sessions VALUES ('bb7ed433-9df5-4cd2-9297-646309f1fefc', 2, '2026-12-03 16:31:37.05', '2026-11-26 16:31:37.05', '207145456ff9bc6540b09b0011e3993c8021a18f6e4bd3a54754425343f89f07', NULL);
INSERT INTO public.sessions VALUES ('e831e762-2e48-4390-8f33-4f6ca8820b81', 2, '2026-12-03 16:31:47.581', '2026-11-26 16:31:47.584', '3665e35a22d7a0e659407ce7f1222efae76776aa8e3cb88124d2960998dc6f36', NULL);
INSERT INTO public.sessions VALUES ('d0dbab4a-4d1a-45de-b573-12f82881f6c5', 2, '2026-12-03 16:31:51.434', '2026-11-26 16:31:51.434', 'e17a0e5af0569a65a0422cc6a7e6e01549949a2cecf8c9fc89691ce49af528c5', NULL);
INSERT INTO public.sessions VALUES ('1412756f-9af6-4d06-b69c-569d4ba8e59b', 2, '2026-12-03 16:31:54.555', '2026-11-26 16:31:54.558', '3c4e746f267cec013147bb28c07b9e358998098fedb0967c2dd4a1b587d19b7e', NULL);
INSERT INTO public.sessions VALUES ('be483164-9e1b-42e4-9de7-812b382cc452', 2, '2026-12-03 16:31:55.916', '2026-11-26 16:31:55.916', '335b79f3f7b6e316be316405ca02682417e4083752207c9def3d65a4926c5a41', NULL);
INSERT INTO public.sessions VALUES ('aedda8fd-5d89-469d-9981-270f1fa6baf4', 43, '2026-12-03 16:32:02.509', '2026-11-26 16:32:02.51', '406b8632efbb2f69fd4c8760eb33fad7a688c9e7c71f1f4e9e8f7c73c236ef19', NULL);
INSERT INTO public.sessions VALUES ('45315c85-cda2-43a6-aa1a-f0899544efb6', 2, '2026-12-03 16:32:12.774', '2026-11-26 16:32:12.777', '4a3ee9fb0dcc8572ffc401d788ae2aae866c1bec27d85a1a61ab4b93a5a38ff1', NULL);
INSERT INTO public.sessions VALUES ('a952cf01-5336-42e3-91b8-3f24b6f8656d', 43, '2026-12-03 16:32:22.745', '2026-11-26 16:32:22.745', 'f5cce4bed29f1e8e2a118faff3d651c2bc31e78ad768d6e2c6a4892863b15a0e', NULL);
INSERT INTO public.sessions VALUES ('c893d07a-2e7c-4b4a-9d4b-209ad13b504e', 43, '2026-12-03 16:32:32.167', '2026-11-26 16:32:32.17', '2027e54daf2e188227cbe84b8d5662cecf27763918d1ab19c969d80b43deca7e', NULL);
INSERT INTO public.sessions VALUES ('082df7af-6fd4-463b-8e96-33d3c14c97db', 2, '2026-12-03 16:32:34.99', '2026-11-26 16:32:34.99', 'd3fc652acd249be801a92a7ddd2f92ad624de2a80cc21f8f8e8e562a47c7fa61', NULL);
INSERT INTO public.sessions VALUES ('5ebaf468-0c7e-470f-9319-3663878f6e3e', 43, '2026-12-03 16:32:47.552', '2026-11-26 16:32:47.555', 'ad67ac83c055d6284a1b94abb9e149c7d067e705b59217d91fbcba21e3d3cb8e', NULL);
INSERT INTO public.sessions VALUES ('cbed1f5c-d890-4c91-9c35-c5d95b2da399', 2, '2026-12-03 16:32:50.368', '2026-11-26 16:32:50.368', '79c1474ce5e9cb39277b85a9dc72ec1937632631e74d81f8677c2d01b9d1c9d5', NULL);
INSERT INTO public.sessions VALUES ('b900522f-f0e2-49e0-aa5d-1a8ca3fda495', 43, '2026-12-03 16:33:07.464', '2026-11-26 16:33:07.467', 'b7707953bf4337868b63ed1e26444c158f4150e0b0a9d3586f145885356ab9cc', NULL);
INSERT INTO public.sessions VALUES ('4d4d18e9-9911-4b93-af20-c5352c630c9a', 2, '2026-12-03 16:33:10.12', '2026-11-26 16:33:10.121', '0a57088a0124eaedf15b2b27b1959352288c6f20b9e40c9d00d747ec67df8de4', NULL);
INSERT INTO public.sessions VALUES ('d6280d6c-3ac8-49e9-8383-eb688eb52bd2', 2, '2026-12-03 16:33:13.748', '2026-11-26 16:33:13.749', '17c740296b63f3c73d891159daefba6aa90f31f903916767241c90fa0e1db32a', NULL);
INSERT INTO public.sessions VALUES ('c9e82ec2-2c3e-490d-9315-75291395ec84', 43, '2026-12-03 16:33:51.763', '2026-11-26 16:33:51.765', '449af1acdaba1db5006e1edb89cfbc5f16e5d12355ca9f6cc785d54dcaf53951', NULL);
INSERT INTO public.sessions VALUES ('a7d3a7b7-de2a-4ae8-ad33-3f37300c0d0b', 2, '2026-12-03 16:33:54.819', '2026-11-26 16:33:54.819', '769e4e8427798bb4b1ea83749081dcc5f0fa42129e76bc73b11edfc91801e1da', NULL);
INSERT INTO public.sessions VALUES ('46a94659-d076-4771-a0b2-efed4701a28e', 2, '2026-12-03 16:34:07.677', '2026-11-26 16:34:07.677', 'eed36899406cacd3b3c4432fed1eb2296c51619c5b81491606bb55a665518f68', NULL);
INSERT INTO public.sessions VALUES ('05e5a427-daab-4791-86db-12f60e71b446', 43, '2026-12-03 16:34:28.941', '2026-11-26 16:34:28.944', '88b276fa029db9df6d1a06b157f696ec4173c940e24239536841a938125c1696', NULL);
INSERT INTO public.sessions VALUES ('22e1874a-f711-4f27-a7ad-f5c5df5f7220', 2, '2026-12-03 16:34:31.765', '2026-11-26 16:34:31.766', '5b1e0b2e38ef6b44824e001b633f3e3dd2ef13505a57843b97222f609f3cd658', NULL);
INSERT INTO public.sessions VALUES ('748eb6f5-39fa-457c-86b8-50d01a250623', 2, '2026-12-03 16:34:35.389', '2026-11-26 16:34:35.389', '0aa8deaf44365656a9730c967aa14768f58f6f9ee6786d956ce586a1ef46da42', NULL);
INSERT INTO public.sessions VALUES ('774df513-a9ea-4045-96f6-f436f3fd000a', 43, '2026-12-03 16:34:51.692', '2026-11-26 16:34:51.695', 'b4fb1fc0075e9f687d1e20b615acf8d01574b00d51e923b0532101810e8a81e0', NULL);
INSERT INTO public.sessions VALUES ('1e695c15-fee7-476b-8e8f-fa6ff0277eca', 2, '2026-12-03 16:34:54.117', '2026-11-26 16:34:54.118', 'ee6006d0f3ae55d124f4412fd0eead219d512379190984792d3781065fc50075', NULL);
INSERT INTO public.sessions VALUES ('39f84be6-a817-43b2-bd5d-7d4a606096ad', 2, '2026-12-03 16:35:06.923', '2026-11-26 16:35:06.923', '63748cc83b781ecd2ac272433f92a61570599f47e1b33f23abb836aa1c20b7d8', NULL);
INSERT INTO public.sessions VALUES ('b7d43356-7cee-4092-b2c7-e0ea9e3fe6f0', 43, '2026-12-04 00:29:41.439', '2026-11-27 00:29:41.442', '19966b6c6113e0f65f17a025e70848f081d18c1c7d73b88972de9216c46165ef', NULL);
INSERT INTO public.sessions VALUES ('9e7eb7a0-f58a-439c-80bf-78bd04d6ef1d', 43, '2026-12-04 00:29:43.102', '2026-11-27 00:29:43.106', 'e2b7b865ebaf527461c7314cb91be32eb9c714322ed9b3084da685bd165b7754', NULL);
INSERT INTO public.sessions VALUES ('d87a0a66-dab4-4150-9691-33a0a176c846', 2, '2026-12-04 00:29:43.358', '2026-11-27 00:29:43.358', '4bf2d67838cb7daefb2adbcf86daa4ec65a303738ef7de905301c5d6b2e5d5f1', NULL);
INSERT INTO public.sessions VALUES ('03cbdd7b-7497-4ee4-b461-017192f0bb74', 43, '2026-12-04 00:29:45.545', '2026-11-27 00:29:45.548', '4db285b2731e0f0f1695d21f6f22a1400df110399c3d9de3bbfeea5908c49bdf', NULL);
INSERT INTO public.sessions VALUES ('f3d564ea-554d-40f4-8e64-465e2e87f042', 43, '2026-12-04 00:29:47.761', '2026-11-27 00:29:47.764', '5397a28145a88e4e4339c63ae2d3d4dc11c94a81f3cf743cffc08ba861535dad', NULL);
INSERT INTO public.sessions VALUES ('222c2d44-f13a-47a9-833f-95cf4227fbba', 2, '2026-12-04 00:29:48.013', '2026-11-27 00:29:48.013', '0d65a2b00c2981813b84a0623d72ea393030983d46e103c87245156674e5343e', NULL);
INSERT INTO public.sessions VALUES ('bb2d9d0f-e289-4095-9ffa-ad8062cd9fa9', 44, '2026-12-04 00:29:48.263', '2026-11-27 00:29:48.264', '4812c4d243072d0f91b59adffea2d15d68065fad7f41712dadb655414e950d75', NULL);
INSERT INTO public.sessions VALUES ('6f4fd004-f353-4141-a770-a615c3f0c7d0', 43, '2026-12-04 00:29:49.928', '2026-11-27 00:29:49.931', 'a24a3d84135fb8869a623f086151bca626484dcdb47b77a5254d73574b5b934a', NULL);
INSERT INTO public.sessions VALUES ('dbd14617-611b-44b3-b2d7-77cad253f3b2', 43, '2026-12-04 00:29:51.59', '2026-11-27 00:29:51.594', '151824340eb7647e07f13a1fd824a6910f8a8d8a1d6b59027621b5f3bbd56a6f', NULL);
INSERT INTO public.sessions VALUES ('81331a66-c4b5-458e-80c9-7a7d0c317402', 2, '2026-12-04 00:29:53.063', '2026-11-27 00:29:53.067', '32c73546068413db4ea81e4ea302744d6a612f85f36889e5a0c3ed2fdfc91dd7', NULL);
INSERT INTO public.sessions VALUES ('cd62762c-72f7-457e-96b6-72ed28254064', 44, '2026-12-04 00:29:53.312', '2026-11-27 00:29:53.312', '16ec70a7367f17d3c245177d7b4904199371250d2060d171981803db29c8ee71', NULL);


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
INSERT INTO public.uploads VALUES (22, 'a4d4d901-9baa-4324-99b3-15c3778ac900.jpg', 2, NULL, '2026-11-25 02:28:14.475', 2);
INSERT INTO public.uploads VALUES (23, '4af900b8-1cd8-47a4-8df0-b48ee362755d.jpg', 43, 54, '2026-11-25 02:31:48.167', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES (1, 'dahye', 'https://picsum.photos/seed/dahye/40/40', NULL, NULL, NULL, NULL, NULL, 'USER', 2);
INSERT INTO public.users VALUES (4, 'nayeon', NULL, NULL, NULL, NULL, NULL, NULL, 'USER', 1);
INSERT INTO public.users VALUES (5, 'seungwoo', 'https://picsum.photos/seed/seungwoo/40/40', NULL, NULL, NULL, NULL, NULL, 'USER', 2);
INSERT INTO public.users VALUES (6, 'sora', NULL, NULL, 'sora@example.com', '한소라', NULL, NULL, 'USER', 0);
INSERT INTO public.users VALUES (9, 'yuna', NULL, NULL, 'yuna@example.com', '김유나', NULL, NULL, 'USER', 0);
INSERT INTO public.users VALUES (10, 'haneul', NULL, NULL, 'haneul.lee@example.com', '이하늘', NULL, NULL, 'USER', 0);
INSERT INTO public.users VALUES (12, 'haneul2', NULL, NULL, 'haneul2@example.com', '이하늘', NULL, NULL, 'USER', 0);
INSERT INTO public.users VALUES (13, 'dain', NULL, NULL, 'dain@example.com', '김다인', NULL, NULL, 'USER', 0);
INSERT INTO public.users VALUES (16, 'jiho', NULL, NULL, NULL, '김지호', '01055551234', NULL, 'USER', 0);
INSERT INTO public.users VALUES (22, 'taeyang', NULL, NULL, NULL, '한태양', '01042427777', NULL, 'USER', 0);
INSERT INTO public.users VALUES (37, 'yuri01b', NULL, NULL, NULL, '한다른', '01051510001', NULL, 'USER', 0);
INSERT INTO public.users VALUES (39, 'yuri02b', NULL, NULL, NULL, '한다른', '01051510002', NULL, 'USER', 0);
INSERT INTO public.users VALUES (41, 'yuri03', NULL, NULL, NULL, '한다른', '01051510004', NULL, 'USER', 0);
INSERT INTO public.users VALUES (47, 'jiwon', NULL, NULL, 'jiwon@example.com', '김지원', NULL, '$2b$12$nOpag4pwF0MODmUHZGJ7DuZYgf5eKEeW1fQqFyw5PUFpUGAPAOfkS', 'USER', 0);
INSERT INTO public.users VALUES (52, 'minji.kim', NULL, NULL, 'minji.kim@gmail.com', '김민지', NULL, NULL, 'USER', 0);
INSERT INTO public.users VALUES (54, 'kim.minji', NULL, NULL, NULL, '김민지', NULL, NULL, 'USER', 0);
INSERT INTO public.users VALUES (3, 'minji', 'https://picsum.photos/seed/minji/40/40', NULL, NULL, NULL, NULL, NULL, 'USER', 21);
INSERT INTO public.users VALUES (44, 'doyun', NULL, NULL, 'doyun@example.com', '최도윤', NULL, '$2b$12$aPixRysEcnPdJT1.ZPKFGOP6RUZCnqaCoMd1kxS0XcmlrhVw22Fge', 'USER', 2);
INSERT INTO public.users VALUES (45, 'admin.hong', NULL, NULL, NULL, '관리자', '01077771234', '$2b$12$0mdVgn8fx7cgzq/Whrncnevn4QPML6x926zpnLrLGZqexpwAqDd4G', 'ADMIN', 1);
INSERT INTO public.users VALUES (48, 'boram', NULL, NULL, 'boram@example.com', '이보람', NULL, '$2b$12$KfomcfsdiNXi7qE6gW7KtOByRKegS/LjfbHSrJRk4kL4x66IL1iYK', 'USER', 1);
INSERT INTO public.users VALUES (43, 'seoyeon', NULL, NULL, 'seoyeon@example.com', '박서연', NULL, '$2b$13$gnik0yWnliyuGlwBd44F3O7DAmeLqoGI4gMxXMVlYtTWpB7NQ1bva', 'USER', 0);
INSERT INTO public.users VALUES (2, 'jaehoon', '/uploads/a4d4d901-9baa-4324-99b3-15c3778ac900.jpg', NULL, NULL, NULL, NULL, '$2b$12$Mjcp.XlG4IFF5U8LCJe9XepdpZ98fyPX7yFks9LHSb5am.O5sbRVq', 'USER', 4);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 365, true);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 12, true);


--
-- Name: direct_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.direct_messages_id_seq', 107, true);


--
-- Name: follows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.follows_id_seq', 42, true);


--
-- Name: hashtags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hashtags_id_seq', 8, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 14, true);


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

SELECT pg_catalog.setval('public.post_likes_id_seq', 18, true);


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
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: hashtags hashtags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hashtags
    ADD CONSTRAINT hashtags_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


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
-- Name: conversations_participant_a_id_participant_b_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX conversations_participant_a_id_participant_b_id_key ON public.conversations USING btree (participant_a_id, participant_b_id);


--
-- Name: conversations_participant_b_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX conversations_participant_b_id_idx ON public.conversations USING btree (participant_b_id);


--
-- Name: direct_messages_conversation_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX direct_messages_conversation_id_created_at_id_idx ON public.direct_messages USING btree (conversation_id, created_at DESC, id DESC);


--
-- Name: follows_follower_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX follows_follower_id_created_at_id_idx ON public.follows USING btree (follower_id, created_at DESC, id DESC);


--
-- Name: follows_follower_id_following_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX follows_follower_id_following_id_key ON public.follows USING btree (follower_id, following_id);


--
-- Name: follows_following_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX follows_following_id_created_at_id_idx ON public.follows USING btree (following_id, created_at DESC, id DESC);


--
-- Name: hashtags_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX hashtags_name_key ON public.hashtags USING btree (name);


--
-- Name: notifications_receiver_id_created_at_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_receiver_id_created_at_id_idx ON public.notifications USING btree (receiver_id, created_at DESC, id DESC);


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
-- Name: conversations conversations_last_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.direct_messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: conversations conversations_participant_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_participant_a_id_fkey FOREIGN KEY (participant_a_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversations conversations_participant_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_participant_b_id_fkey FOREIGN KEY (participant_b_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_follow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_follow_id_fkey FOREIGN KEY (follow_id) REFERENCES public.follows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_post_like_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_post_like_id_fkey FOREIGN KEY (post_like_id) REFERENCES public.post_likes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


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

\unrestrict 52FQX41p2Y60BiCZ5fiCwblVYn6vI1oV511MQb99vyk0SGV8Ju8cRTbaeUSa3J5

