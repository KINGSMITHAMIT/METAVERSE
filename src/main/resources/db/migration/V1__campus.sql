create table accounts (
    username varchar(24) primary key,
    password_hash varchar(100) not null
);
create table workspaces (
    id uuid primary key,
    title varchar(60) not null,
    owner varchar(24) not null references accounts(username),
    map_key varchar(30) not null
);
create table members (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id),
    username varchar(24) not null references accounts(username),
    voice_blocked boolean not null,
    unique (workspace_id, username)
);
create table invitations (
    id uuid primary key,
    workspace_id uuid not null references workspaces(id),
    invitee varchar(24) not null,
    expires_at timestamp with time zone not null,
    consumed boolean not null
);
