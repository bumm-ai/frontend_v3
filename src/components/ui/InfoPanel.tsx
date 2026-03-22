'use client';

import { useState } from 'react';
import { Zap, Plus } from 'lucide-react';
import { NetworkToggle } from './NetworkToggle';
import { ContractMenu } from './ContractMenu';
import ProjectsList from './ProjectsList';
import { Project } from '@/types/dashboard';
import { useCredits } from '@/hooks/useCredits';

interface Contract {
  id: string;
  address: string;
  name: string;
  network: 'devnet' | 'testnet' | 'mainnet';
  createdAt: string;
}

interface InfoPanelProps {
  projects?: Project[];
  onSelectProject?: (project: Project) => void;
  selectedProject?: Project | null;
  isLoading?: boolean;
  onCreateNew?: () => void;
  onRenameProject?: (project: Project, newName: string) => void;
  onDeleteProject?: (project: Project) => void;
  onArchiveProject?: (project: Project) => void;
  onDuplicateProject?: (project: Project) => void;
  onCreateGroup?: (project: Project) => void;
  onAddToGroup?: (project: Project) => void;
  onToggleVisibility?: (project: Project) => void;
  onExportProject?: (project: Project) => void;
}

export const InfoPanel = ({ 
  projects = [], 
  onSelectProject, 
  selectedProject,
  isLoading = false,
  onCreateNew,
  onRenameProject,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onCreateGroup,
  onAddToGroup,
  onToggleVisibility,
  onExportProject
}: InfoPanelProps) => {
  const [currentNetwork, setCurrentNetwork] = useState<'devnet' | 'mainnet'>('devnet');
  const [contracts, setContracts] = useState<Contract[]>([
    {
      id: '1',
      address: 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS',
      name: 'My First Contract',
      network: 'devnet',
      createdAt: '2 hours ago'
    }
  ]);

  const { balance } = useCredits();

  const handleNetworkChange = (network: 'devnet' | 'mainnet') => {
    setCurrentNetwork(network);
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      // Fallback to local creation if no callback provided
      const newContract: Contract = {
        id: Date.now().toString(),
        address: generateMockAddress(),
        name: `Contract ${contracts.length + 1}`,
        network: currentNetwork,
        createdAt: 'Just now'
      };
      setContracts([newContract, ...contracts]);
    }
  };

  const handleDestroyContract = (contractId: string) => {
    setContracts(contracts.filter(contract => contract.id !== contractId));
  };


  const generateMockAddress = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'devnet': return 'text-blue-400 bg-blue-500/20';
      case 'testnet': return 'text-yellow-400 bg-yellow-500/20';
      case 'mainnet': return 'text-green-400 bg-green-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0C0C0C] border border-[#333] rounded">
      {/* Network Toggle - в одну строку без заголовка */}
      <div className="px-2 py-1 border-b border-[#191919] flex-shrink-0">
        <NetworkToggle onChange={handleNetworkChange} />
      </div>

      {/* Create New Contract - очень компактная версия */}
      <div className="px-2 py-1.5 border-b border-[#191919] flex-shrink-0">
        <button
          onClick={handleCreateNew}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-transparent border border-orange-500 text-orange-500 rounded hover:bg-orange-500 transition-all text-[10px] font-medium"
        >
          <Plus className="w-3 h-3" />
          Create New
        </button>
      </div>

      {/* Projects List - основная область */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <ProjectsList 
          projects={projects}
          onSelectProject={onSelectProject}
          selectedProject={selectedProject}
          isLoading={isLoading}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
          onArchiveProject={onArchiveProject}
          onDuplicateProject={onDuplicateProject}
          onCreateGroup={onCreateGroup}
          onAddToGroup={onAddToGroup}
          onToggleVisibility={onToggleVisibility}
          onExportProject={onExportProject}
        />
      </div>

      {/* Credits - стиль из демо-блока */}
      <div className="border-t border-[#191919] px-3 py-3 flex items-center">
        <div className="text-center w-full">
          <div className="flex items-center justify-center gap-0.5">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-orange-500 text-[12px] font-medium credits-text">
              Credits: {Math.floor(balance.balance).toLocaleString()}
            </span>
          </div>
          <p className="text-[8px] text-[#666] mt-1">Fuel for AI Brain</p>
        </div>
      </div>
    </div>
  );
};
